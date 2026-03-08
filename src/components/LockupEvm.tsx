import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import { randomBytes } from "crypto";
import {
    AbiCoder,
    MaxUint256,
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

import { AssetKind, getKindForAsset, getTokenAddress } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    type Signer,
    createRouterContract,
    createTokenContract,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import type { EncodedHop } from "../utils/Pair";
import {
    type QuoteData,
    encodeDexQuote,
    getCommitmentLockupDetails,
    postCommitmentSignature,
    quoteDexAmountOut,
} from "../utils/boltzClient";
import { calculateAmountWithSlippage } from "../utils/calculate";
import {
    getCommitmentLockupEvent,
    getSignerForGasAbstraction,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import { GasAbstractionType, type SomeSwap } from "../utils/swapCreator";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";
import OptimizedRoute from "./OptimizedRoute";

const lockupGasUsage = 46_000n;

const getHopExecutionQuote = async (
    hop: EncodedHop,
    lockupAmount: bigint,
    slippage: number,
): Promise<{
    targetLockupAmount: bigint;
    quote: QuoteData;
    amountIn: bigint;
}> => {
    const targetLockupAmount = calculateAmountWithSlippage(
        lockupAmount,
        slippage / 2,
    );

    const quotes = await quoteDexAmountOut(
        hop.dexDetails.chain,
        hop.dexDetails.tokenIn,
        hop.dexDetails.tokenOut,
        targetLockupAmount,
    );

    if (!Array.isArray(quotes) || quotes.length === 0) {
        log.error("No DEX quotes returned for lockup hop", {
            dexDetails: hop.dexDetails,
            targetLockupAmount: targetLockupAmount.toString(),
        });
        throw new Error("could not get DEX quote for lockup hop");
    }

    const quote = quotes[0];

    return {
        quote,
        targetLockupAmount,
        amountIn: BigInt(quote.quote),
    };
};

const hashRouterCalls = (
    calls: { target: string; value: string | bigint; callData: string }[],
) => {
    const encodedCalls = AbiCoder.defaultAbiCoder().encode(
        ["tuple(address target, uint256 value, bytes callData)[]"],
        [calls],
    );

    return ethersKeccak256(encodedCalls);
};

const lockupErc20WithPermit2 = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    amount: bigint,
    preimageHash: string,
    claimAddress: string,
    timeoutBlockHeight: number,
    signer: Signer,
    transactionSigner: Signer | Wallet,
): Promise<string> => {
    const router = createRouterContract(asset, transactionSigner);
    const routerAddress = await router.getAddress();
    const tokenAddress = getTokenAddress(asset);
    const calls: {
        target: string;
        value: string | bigint;
        callData: string;
    }[] = [];
    const callsHash = hashRouterCalls(calls);

    const [permit2Address, chainId, refundAddress] = await Promise.all([
        router.PERMIT2(),
        transactionSigner.provider
            .getNetwork()
            .then((network) => network.chainId),
        signer.getAddress(),
    ]);

    const nonce = BigInt("0x" + randomBytes(32).toString("hex"));
    const permit2DeadlineSeconds = 1_800;
    const deadline = BigInt(
        Math.floor(Date.now() / 1000) + permit2DeadlineSeconds,
    );

    const permit2Signature = await signer.signTypedData(
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
                token: tokenAddress,
                amount,
            },
            spender: routerAddress,
            nonce,
            deadline,
            witness: {
                preimageHash: prefix0x(preimageHash),
                token: tokenAddress,
                claimAddress,
                refundAddress,
                timelock: timeoutBlockHeight,
                callsHash,
            },
        },
    );

    const tx = await router.executeAndLockERC20WithPermit2.populateTransaction(
        prefix0x(preimageHash),
        tokenAddress,
        claimAddress,
        refundAddress,
        timeoutBlockHeight,
        calls,
        {
            permitted: {
                token: tokenAddress,
                amount,
            },
            nonce,
            deadline,
        },
        refundAddress,
        permit2Signature,
    );

    return await sendPopulatedTransaction(
        gasAbstraction,
        transactionSigner,
        tx,
    );
};

const lockupWithHops = async (
    hops: EncodedHop[],
    gasAbstraction: GasAbstractionType,
    asset: string,
    swapId: string,
    lockupAmount: bigint,
    preimageHash: string,
    getErc20Swap: (asset: string) => ERC20Swap,
    signer: Accessor<Signer>,
    getGasAbstractionSigner: (asset: string) => Wallet,
    slippage: number,
    getSwap: (id: string) => Promise<SomeSwap>,
    setSwap: Setter<SomeSwap | null>,
    setSwapStorage: (swap: SomeSwap) => Promise<void>,
): Promise<string> => {
    if (hops.length !== 1) {
        throw new Error("only one hop is supported for now");
    }

    const hop = hops[0];

    const { targetLockupAmount, quote, amountIn } = await getHopExecutionQuote(
        hop,
        lockupAmount,
        slippage,
    );
    log.info(`Got DEX quote for lockup hop: ${quote.quote}`, quote.data);

    const transactionSigner = getSignerForGasAbstraction(
        gasAbstraction,
        signer(),
        getGasAbstractionSigner(asset),
    );
    const router = createRouterContract(hop.from, transactionSigner);
    const routerAddress = await router.getAddress();

    const calldata = await encodeDexQuote(
        hop.dexDetails.chain,
        routerAddress,
        amountIn,
        targetLockupAmount,
        quote.data,
    );

    const erc20Swap = getErc20Swap(asset);
    const [permit2Address, chainId, signerAddress, version] = await Promise.all(
        [
            router.PERMIT2(),
            transactionSigner.provider.getNetwork().then((n) => n.chainId),
            signer().getAddress(),
            erc20Swap.version(),
        ],
    );

    const calls = calldata.calls.map((call) => ({
        target: call.to,
        value: call.value,
        callData: prefix0x(call.data),
    }));

    // Must match the Solidity contract's abi.encode of Call[] struct.
    const callsHash = hashRouterCalls(calls);

    const nonce = BigInt("0x" + randomBytes(32).toString("hex"));

    const permit2DeadlineSeconds = 1_800;
    const deadline = BigInt(
        Math.floor(Date.now() / 1000) + permit2DeadlineSeconds,
    );

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
        signerAddress,
        permit2Signature,
    );

    const transactionHash = await sendPopulatedTransaction(
        gasAbstraction,
        transactionSigner,
        tx,
    );
    const currentSwap = await getSwap(swapId);
    currentSwap.commitmentLockupTxHash = transactionHash;
    setSwap(currentSwap);
    await setSwapStorage(currentSwap);

    // The commitment signature must include the actually locked amount from the Lockup event.
    const receipt = await transactionSigner.provider.waitForTransaction(
        transactionHash,
        1,
        120_000,
    );
    if (receipt === null) {
        throw new Error(
            "could not fetch commitment lockup transaction receipt",
        );
    }

    const {
        amount: lockupEventAmount,
        tokenAddress: lockupTokenAddress,
        claimAddress: lockupClaimAddress,
        refundAddress: lockupRefundAddress,
        timelock: lockupTimelock,
        logIndex: lockupLogIndex,
    } = getCommitmentLockupEvent(
        erc20Swap,
        receipt,
        commitmentLockupDetails.contract,
    );

    const commitmentSignature = await signer().signTypedData(
        {
            name: "ERC20Swap",
            version: String(version),
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
        lockupLogIndex,
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
    gasAbstraction: GasAbstractionType;
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
                    value={
                        props.gasAbstraction === GasAbstractionType.Signer
                            ? () => MaxUint256
                            : (props.approvalValue ?? props.value)
                    }
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
                    const transactionSigner = getSignerForGasAbstraction(
                        props.gasAbstraction,
                        signer(),
                        getGasAbstractionSigner(props.asset),
                    );

                    if (props.hops !== undefined && props.hops.length > 0) {
                        transactionHash = await lockupWithHops(
                            props.hops,
                            props.gasAbstraction,
                            props.asset,
                            props.swapId,
                            props.value(),
                            props.preimageHash,
                            getErc20Swap,
                            signer,
                            getGasAbstractionSigner,
                            slippage(),
                            getSwap,
                            setSwap,
                            setSwapStorage,
                        );
                    } else if (
                        getKindForAsset(props.asset) === AssetKind.EVMNative
                    ) {
                        const contract = getEtherSwap(props.asset);
                        const connectedContract =
                            contract.connect(transactionSigner);
                        const tx = await connectedContract[
                            "lock(bytes32,address,uint256)"
                        ].populateTransaction(
                            prefix0x(props.preimageHash),
                            props.claimAddress,
                            props.timeoutBlockHeight,
                            {
                                value: props.value(),
                            },
                        );
                        transactionHash = await sendPopulatedTransaction(
                            props.gasAbstraction,
                            transactionSigner,
                            tx,
                        );
                    } else {
                        if (props.gasAbstraction === GasAbstractionType.None) {
                            const contract = getErc20Swap(props.asset);
                            const connectedContract =
                                contract.connect(transactionSigner);
                            const tx = await connectedContract[
                                "lock(bytes32,uint256,address,address,uint256)"
                            ].populateTransaction(
                                prefix0x(props.preimageHash),
                                props.value(),
                                getTokenAddress(props.asset),
                                props.claimAddress,
                                props.timeoutBlockHeight,
                            );
                            transactionHash = await sendPopulatedTransaction(
                                props.gasAbstraction,
                                transactionSigner,
                                tx,
                            );
                        } else {
                            transactionHash = await lockupErc20WithPermit2(
                                props.gasAbstraction,
                                props.asset,
                                props.value(),
                                props.preimageHash,
                                props.claimAddress,
                                props.timeoutBlockHeight,
                                signer(),
                                transactionSigner,
                            );
                        }
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
    gasAbstraction: GasAbstractionType;
    swapId: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
    hops?: EncodedHop[];
}) => {
    const { slippage } = useGlobalContext();
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

            const [balance, allowance, requiredValue] = await Promise.all([
                hopInputContract.balanceOf(signerAddress),
                hopInputContract.allowance(signerAddress, permit2Address),
                getHopExecutionQuote(hop, value(), slippage()).then(
                    ({ amountIn }) => amountIn,
                ),
            ]);

            log.info("Hop input token balance", balance);
            log.info(
                "Hop required amount (DEX quote + slippage)",
                requiredValue,
            );

            setSignerBalance(balance);
            setRequiredValue(requiredValue);
            // Permit2 requires a one-time unlimited approval of the
            // input token to the Permit2 contract
            setNeedsApproval(allowance < requiredValue);
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
                setNeedsApproval(false);
                setApprovalTarget(undefined);

                break;
            }
            case AssetKind.ERC20: {
                const contract = createTokenContract(props.asset, signer());
                const router = createRouterContract(props.asset, signer());

                const approvalTarget =
                    props.gasAbstraction !== GasAbstractionType.None
                        ? await router.PERMIT2()
                        : await getErc20Swap(props.asset).getAddress();

                const [balance, allowance] = await Promise.all([
                    contract.balanceOf(await signer().getAddress()),
                    contract.allowance(
                        await signer().getAddress(),
                        approvalTarget,
                    ),
                ]);

                log.info("ERC20 signer balance", balance);

                const needsApproval = allowance < value();
                log.info("ERC20 signer needs approval", needsApproval);

                setSignerBalance(balance);
                setRequiredValue(value());
                setNeedsApproval(needsApproval);
                setApprovalTarget(approvalTarget);

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
                        signerBalance() >= requiredValue()
                    }
                    fallback={<InsufficientBalance asset={userAsset()} />}>
                    <LockupTransaction
                        asset={props.asset}
                        gasAbstraction={props.gasAbstraction}
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
