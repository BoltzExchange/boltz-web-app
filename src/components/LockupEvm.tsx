import { randomBytes } from "crypto";
import {
    AbiCoder,
    Interface,
    MaxUint256,
    type Signer,
    type Wallet,
    keccak256 as ethersKeccak256,
} from "ethers";
import log from "loglevel";
import {
    type Accessor,
    type Setter,
    Show,
    createEffect,
    createSignal,
} from "solid-js";

import { sendTransaction } from "../alchemy/Alchemy";
import { AssetKind, getKindForAsset, getTokenAddress } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    ERC20SwapAbi,
    createRouterContract,
    createTokenContract,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import type { EncodedHop } from "../utils/Pair";
import {
    encodeDexQuote,
    getCommitmentLockupDetails,
    postCommitmentSignature,
    quoteDexAmountOut,
} from "../utils/boltzClient";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";
import OptimizedRoute from "./OptimizedRoute";

const lockupGasUsage = 46_000n;

const lockupWithHops = async (
    hops: EncodedHop[],
    asset: string,
    swapId: string,
    lockupAmount: bigint,
    preimageHash: string,
    signer: Accessor<Signer>,
    getGasAbstractionSigner: (asset: string) => Wallet,
    slippage: number,
): Promise<string> => {
    if (hops.length !== 1) {
        throw new Error("only one hop is supported for now");
    }

    const hop = hops[0];

    const targetLockupAmount = BigInt(
        // TOOD: is this reasonnable?
        Math.ceil(Number(lockupAmount) * (1 + slippage / 2)),
    );

    const quote = (
        await quoteDexAmountOut(
            hop.dexDetails.chain,
            hop.dexDetails.tokenIn,
            hop.dexDetails.tokenOut,
            targetLockupAmount,
        )
    )[0];
    log.info(`Got DEX quote for lockup hop: ${quote.quote}`, quote.data);

    const amountIn = BigInt(Math.ceil(Number(quote.quote) * (1 + slippage)));

    const gasSigner = getGasAbstractionSigner(asset);
    const router = createRouterContract(hop.from, gasSigner);
    const routerAddress = await router.getAddress();

    const calldata = await encodeDexQuote(
        hop.dexDetails.chain,
        routerAddress,
        amountIn,
        targetLockupAmount,
        quote.data,
    );

    const [permit2Address, chainId, signerAddress] = await Promise.all([
        router.PERMIT2(),
        gasSigner.provider.getNetwork().then((n) => n.chainId),
        signer().getAddress(),
    ]);

    const calls = calldata.calls.map((call) => ({
        target: call.to,
        value: call.value,
        callData: prefix0x(call.data),
    }));

    // Compute callsHash: keccak256(abi.encode(calls))
    // Must match the Solidity contract's abi.encode of Call[] struct
    const encodedCalls = AbiCoder.defaultAbiCoder().encode(
        ["tuple(address target, uint256 value, bytes callData)[]"],
        [calls],
    );
    const callsHash = ethersKeccak256(encodedCalls);

    const nonce = BigInt("0x" + randomBytes(32).toString("hex"));
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

    const tokenAddress = getTokenAddress(asset);
    const commitmentLockupDetails = await getCommitmentLockupDetails(asset);
    const commitmentPreimageHash = "00".repeat(32);

    const permit2Signature = await signer().signTypedData(
        {
            name: "Permit2",
            verifyingContract: permit2Address,
            chainId,
        },
        {
            PermitWitnessTransferFrom: [
                { name: "permitted", type: "TokenPermissions" },
                { name: "spender", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
                { name: "witness", type: "ExecuteAndLockERC20" },
            ],
            TokenPermissions: [
                { name: "token", type: "address" },
                { name: "amount", type: "uint256" },
            ],
            ExecuteAndLockERC20: [
                { name: "preimageHash", type: "bytes32" },
                { name: "token", type: "address" },
                { name: "claimAddress", type: "address" },
                { name: "refundAddress", type: "address" },
                { name: "timelock", type: "uint256" },
                { name: "callsHash", type: "bytes32" },
            ],
        },
        {
            permitted: {
                token: hop.dexDetails.tokenIn,
                amount: amountIn,
            },
            spender: routerAddress,
            nonce,
            deadline,
            witness: {
                preimageHash: prefix0x(commitmentPreimageHash),
                token: tokenAddress,
                claimAddress: commitmentLockupDetails.claimAddress,
                refundAddress: signerAddress,
                timelock: commitmentLockupDetails.timelock,
                callsHash,
            },
        },
    );

    // Encode the transaction calldata without executing
    const tx = await router.executeAndLockERC20WithPermit2.populateTransaction(
        prefix0x(commitmentPreimageHash),
        tokenAddress,
        commitmentLockupDetails.claimAddress,
        signerAddress,
        commitmentLockupDetails.timelock,
        calls,
        {
            permitted: {
                token: hop.dexDetails.tokenIn,
                amount: amountIn,
            },
            nonce,
            deadline,
        },
        permit2Signature,
    );

    // Send via Alchemy account abstraction
    const transactionHash = await sendTransaction(gasSigner, chainId, [
        { to: tx.to, data: tx.data },
    ]);

    // The commitment signature must include the actually locked amount from the Lockup event.
    const receipt = await gasSigner.provider.waitForTransaction(
        transactionHash,
        1,
        120_000,
    );
    if (receipt === null) {
        throw new Error(
            "could not fetch commitment lockup transaction receipt",
        );
    }

    const erc20SwapInterface = new Interface(ERC20SwapAbi);
    const lockupLog = receipt.logs.find((eventLog) => {
        if (
            eventLog.address.toLowerCase() !==
            commitmentLockupDetails.contract.toLowerCase()
        ) {
            return false;
        }

        try {
            const parsedLog = erc20SwapInterface.parseLog({
                data: eventLog.data,
                topics: eventLog.topics,
            });
            return parsedLog?.name === "Lockup";
        } catch {
            return false;
        }
    });

    if (lockupLog === undefined) {
        throw new Error("could not find commitment lockup event");
    }

    const parsedLockup = erc20SwapInterface.parseLog({
        data: lockupLog.data,
        topics: lockupLog.topics,
    });
    if (parsedLockup?.name !== "Lockup") {
        throw new Error("could not parse commitment lockup event");
    }

    const {
        amount: lockupEventAmount,
        tokenAddress: lockupTokenAddress,
        claimAddress: lockupClaimAddress,
        refundAddress: lockupRefundAddress,
        timelock: lockupTimelock,
    } = parsedLockup.args;

    const commitmentSignature = await signer().signTypedData(
        {
            name: "ERC20Swap",
            version: "5",
            verifyingContract: commitmentLockupDetails.contract,
            chainId,
        },
        {
            Commit: [
                { name: "preimageHash", type: "bytes32" },
                { name: "amount", type: "uint256" },
                { name: "tokenAddress", type: "address" },
                { name: "claimAddress", type: "address" },
                { name: "refundAddress", type: "address" },
                { name: "timelock", type: "uint256" },
            ],
        },
        {
            preimageHash: prefix0x(preimageHash),
            amount: lockupEventAmount,
            tokenAddress: lockupTokenAddress,
            claimAddress: lockupClaimAddress,
            refundAddress: lockupRefundAddress,
            timelock: lockupTimelock,
        },
    );

    await postCommitmentSignature(
        asset,
        swapId,
        commitmentSignature,
        transactionHash,
        lockupLog.index,
        slippage * 100,
    );

    return transactionHash;
};

const InsufficientBalance = (props: { asset?: string }) => {
    const { t } = useGlobalContext();

    return (
        <>
            <p>{t("insufficient_balance_line")}</p>
            <ConnectWallet asset={props.asset} />
            <button class="btn" disabled={true}>
                {t("insufficient_balance")}
            </button>
        </>
    );
};

const ApproveErc20 = (props: {
    asset: string;
    value: () => bigint;
    signerAddress: string;
    derivationPath: string;
    setNeedsApproval: Setter<boolean>;
    approvalTarget?: string;
}) => {
    const { t } = useGlobalContext();
    const { signer, getErc20Swap } = useWeb3Signer();

    return (
        <ContractTransaction
            asset={props.asset}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const contract = createTokenContract(props.asset, signer());
                const target =
                    props.approvalTarget ??
                    (await getErc20Swap(props.asset).getAddress());
                const tx = await contract.approve(target, props.value());
                await tx.wait(1);
                log.info("ERC20 approval successful", tx.hash);
                props.setNeedsApproval(false);
            }}
            children={<ConnectWallet asset={props.asset} />}
            address={{
                address: props.signerAddress,
                derivationPath: props.derivationPath,
            }}
            buttonText={t("approve_erc20")}
            promptText={t("approve_erc20_line", {
                button: t("approve_erc20"),
            })}
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

const LockupTransaction = (props: {
    asset: string;
    value: () => bigint;
    preimageHash: string;
    claimAddress: string;
    timeoutBlockHeight: number;
    signerAddress: string;
    derivationPath?: string;
    swapId: string;
    needsApproval: Accessor<boolean>;
    setNeedsApproval: Setter<boolean>;
    approvalAsset?: string;
    approvalValue?: () => bigint;
    approvalTarget?: string;
    hops?: EncodedHop[];
}) => {
    const { setSwap } = usePayContext();
    const { t, slippage, getSwap, setSwapStorage } = useGlobalContext();
    const {
        getErc20Swap,
        getEtherSwap,
        signer,
        providers,
        getGasAbstractionSigner,
    } = useWeb3Signer();

    return (
        <Show
            when={!props.needsApproval()}
            fallback={
                <ApproveErc20
                    asset={props.approvalAsset ?? props.asset}
                    value={props.approvalValue ?? props.value}
                    signerAddress={props.signerAddress}
                    derivationPath={props.derivationPath}
                    setNeedsApproval={props.setNeedsApproval}
                    approvalTarget={props.approvalTarget}
                />
            }>
            <ContractTransaction
                asset={props.asset}
                /* eslint-disable-next-line solid/reactivity */
                onClick={async () => {
                    let transactionHash: string;

                    if (props.hops !== undefined && props.hops.length > 0) {
                        transactionHash = await lockupWithHops(
                            props.hops,
                            props.asset,
                            props.swapId,
                            props.value(),
                            props.preimageHash,
                            signer,
                            getGasAbstractionSigner,
                            slippage(),
                        );
                    } else if (
                        getKindForAsset(props.asset) === AssetKind.EVMNative
                    ) {
                        const contract = getEtherSwap(props.asset);
                        transactionHash = (
                            await contract["lock(bytes32,address,uint256)"](
                                prefix0x(props.preimageHash),
                                props.claimAddress,
                                props.timeoutBlockHeight,
                                {
                                    value: props.value(),
                                },
                            )
                        ).hash;
                    } else {
                        const contract = getErc20Swap(props.asset);
                        transactionHash = (
                            await contract[
                                "lock(bytes32,uint256,address,address,uint256)"
                            ](
                                prefix0x(props.preimageHash),
                                props.value(),
                                getTokenAddress(props.asset),
                                props.claimAddress,
                                props.timeoutBlockHeight,
                            )
                        ).hash;
                    }

                    const currentSwap = await getSwap(props.swapId);
                    currentSwap.lockupTx = transactionHash;
                    currentSwap.signer = signer().address;

                    if (customDerivationPathRdns.includes(signer().rdns)) {
                        currentSwap.derivationPath = (
                            providers()[signer().rdns]
                                .provider as unknown as HardwareSigner
                        ).getDerivationPath();
                    }

                    setSwap(currentSwap);
                    await setSwapStorage(currentSwap);
                }}
                children={<ConnectWallet asset={props.asset} />}
                address={{
                    address: props.signerAddress,
                    derivationPath: props.derivationPath,
                }}
                buttonText={t("send")}
                promptText={t("transaction_prompt", {
                    button: t("send"),
                })}
                waitingText={t("tx_in_mempool_subline")}
                showHr={false}
            />
        </Show>
    );
};

const LockupEvm = (props: {
    asset: string;
    swapId: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
    hops?: EncodedHop[];
}) => {
    const { getErc20Swap, signer } = useWeb3Signer();

    const value = () => satsToAssetAmount(props.amount, props.asset);

    const hasHopsBefore = () =>
        props.hops !== undefined && props.hops.length > 0;

    // The actual asset the user needs to hold (hop input token or boltz asset)
    const userAsset = () =>
        hasHopsBefore() ? props.hops[0].from : props.asset;

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [requiredValue, setRequiredValue] = createSignal<bigint>(0n);
    const [approvalTarget, setApprovalTarget] = createSignal<string>(undefined);

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (signer() === undefined) {
            return;
        }

        if (hasHopsBefore()) {
            const hop = props.hops[0];
            const hopInputContract = createTokenContract(hop.from, signer());
            const router = createRouterContract(hop.from, signer());
            const [permit2Address, signerAddress] = await Promise.all([
                router.PERMIT2(),
                signer().getAddress(),
            ]);

            const [balance, allowance, quotes] = await Promise.all([
                hopInputContract.balanceOf(signerAddress),
                hopInputContract.allowance(signerAddress, permit2Address),
                quoteDexAmountOut(
                    hop.dexDetails.chain,
                    hop.dexDetails.tokenIn,
                    hop.dexDetails.tokenOut,
                    value(),
                ),
            ]);

            const minQuoteIn = quotes.reduce((min, q) => {
                const amountIn = BigInt(q.quote);
                return amountIn < min ? amountIn : min;
            }, BigInt(quotes[0].quote));

            log.info("Hop input token balance", balance);
            log.info("Hop required amount (DEX quote)", minQuoteIn);

            setSignerBalance(balance);
            setRequiredValue(minQuoteIn);
            // Permit2 requires a one-time unlimited approval of the
            // input token to the Permit2 contract
            setNeedsApproval(allowance < minQuoteIn);
            setApprovalTarget(permit2Address);

            return;
        }

        switch (getKindForAsset(props.asset)) {
            case AssetKind.EVMNative: {
                const [balance, gasPrice] = await Promise.all([
                    signer().provider.getBalance(await signer().getAddress()),
                    signer()
                        .provider.getFeeData()
                        .then((data) => data.gasPrice),
                ]);

                const spendable = balance - gasPrice * lockupGasUsage;
                log.info("EVM signer spendable balance", spendable);
                setSignerBalance(spendable);
                setRequiredValue(value());

                break;
            }
            case AssetKind.ERC20: {
                const contract = createTokenContract(props.asset, signer());

                const [balance, allowance] = await Promise.all([
                    contract.balanceOf(await signer().getAddress()),
                    contract.allowance(
                        await signer().getAddress(),
                        getErc20Swap(props.asset).getAddress(),
                    ),
                ]);

                log.info("ERC20 signer balance", balance);

                const needsApproval = allowance < value();
                log.info("ERC20 signer needs approval", needsApproval);

                setSignerBalance(balance);
                setRequiredValue(value());
                setNeedsApproval(needsApproval);

                break;
            }
            default:
                break;
        }
    });

    return (
        <>
            <OptimizedRoute />
            <Show
                when={signerBalance() !== undefined}
                fallback={
                    <Show
                        when={signer() !== undefined}
                        fallback={<ConnectWallet asset={props.asset} />}>
                        <LoadingSpinner />
                    </Show>
                }>
                <Show
                    when={
                        signer() === undefined ||
                        signerBalance() > requiredValue()
                    }
                    fallback={<InsufficientBalance asset={userAsset()} />}>
                    <LockupTransaction
                        asset={props.asset}
                        value={value}
                        preimageHash={props.preimageHash}
                        claimAddress={props.claimAddress}
                        timeoutBlockHeight={props.timeoutBlockHeight}
                        signerAddress={props.signerAddress}
                        derivationPath={props.derivationPath}
                        swapId={props.swapId}
                        needsApproval={needsApproval}
                        setNeedsApproval={setNeedsApproval}
                        approvalAsset={
                            hasHopsBefore() ? props.hops[0].from : undefined
                        }
                        approvalValue={
                            hasHopsBefore() ? () => MaxUint256 : undefined
                        }
                        approvalTarget={approvalTarget()}
                        hops={hasHopsBefore() ? props.hops : undefined}
                    />
                </Show>
            </Show>
        </>
    );
};

export default LockupEvm;
