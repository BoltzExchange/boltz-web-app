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
    createMemo,
    createResource,
    createSignal,
} from "solid-js";

import { config } from "../config";
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
    quoteDexAmountOut,
} from "../utils/boltzClient";
import { calculateAmountWithSlippage } from "../utils/calculate";
import {
    getSignerForGasAbstraction,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import {
    createOftContract,
    getOftContract,
    getQuotedOftContract,
    quoteOftSend,
} from "../utils/oft/oft";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    GasAbstractionType,
    type OftDetail,
    type SomeSwap,
} from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import BlockExplorer, { ExplorerKind } from "./BlockExplorer";
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
    connectedSigner: Signer,
    getGasAbstractionSigner: (asset: string) => Wallet,
    slippage: number,
    getSwap: (id: string) => Promise<SomeSwap>,
    setSwap: Setter<SomeSwap | null>,
    setSwapStorage: (swap: SomeSwap) => Promise<void>,
): Promise<string> => {
    const transactionSigner = getSignerForGasAbstraction(
        gasAbstraction,
        connectedSigner,
        getGasAbstractionSigner(asset),
    );

    const lockup = async () => {
        if (hops.length !== 1) {
            throw new Error("only one hop is supported for now");
        }

        const hop = hops[0];

        const { targetLockupAmount, quote, amountIn } =
            await getHopExecutionQuote(hop, lockupAmount, slippage);
        log.info(`Got DEX quote for lockup hop: ${quote.quote}`, quote.data);

        const router = createRouterContract(hop.from, transactionSigner);
        const routerAddress = await router.getAddress();

        const calldata = await encodeDexQuote(
            hop.dexDetails.chain,
            routerAddress,
            amountIn,
            targetLockupAmount,
            quote.data,
        );

        const [permit2Address, chainId, ownerAddress] = await Promise.all([
            router.PERMIT2(),
            transactionSigner.provider.getNetwork().then((n) => n.chainId),
            connectedSigner.getAddress(),
        ]);
        const refundAddress = transactionSigner.address;

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

        const permit2Signature = await connectedSigner.signTypedData(
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
                    refundAddress: refundAddress,
                    timelock: commitmentLockupDetails.timelock,
                    callsHash,
                },
            },
        );

        // Encode the transaction calldata without executing
        const tx =
            await router.executeAndLockERC20WithPermit2.populateTransaction(
                prefix0x(commitmentPreimageHash),
                tokenAddress,
                commitmentLockupDetails.claimAddress,
                refundAddress,
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
                ownerAddress,
                permit2Signature,
            );

        log.info("Broadcasting commitment lockup with hops", {
            swapId,
            asset,
            gasAbstraction,
            amountIn: amountIn.toString(),
            targetLockupAmount: targetLockupAmount.toString(),
            routerAddress,
        });
        const transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx,
        );
        const currentSwap = await getSwap(swapId);
        currentSwap.commitmentLockupTxHash = transactionHash;
        currentSwap.commitmentSignatureSubmitted = false;
        currentSwap.signer = ownerAddress;
        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
        log.info("Persisted commitment lockup tx hash for background worker", {
            swapId,
            asset,
            commitmentLockupTxHash: transactionHash,
        });

        return transactionHash;
    };

    let commitmentTxHash: string | undefined = (await getSwap(swapId))
        .commitmentLockupTxHash;
    if (commitmentTxHash === undefined) {
        commitmentTxHash = await lockup();
    } else {
        log.debug("Reusing existing commitment lockup tx hash", {
            swapId,
            asset,
            commitmentLockupTxHash: commitmentTxHash,
        });
    }

    return commitmentTxHash;
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

const WaitForOft = (props: { asset: string; transactionHash: string }) => {
    const { t } = useGlobalContext();

    return (
        <>
            <h2>{t("waiting_for_oft")}</h2>
            <LoadingSpinner />
            <BlockExplorer
                asset={props.asset}
                txId={props.transactionHash}
                explorer={ExplorerKind.LayerZero}
                typeLabel={"lockup_tx"}
            />
        </>
    );
};

const SendToOft = (props: {
    oft: OftDetail;
    swapId: string;
    signerAddress: string;
    amount: bigint;
    derivationPath?: string;
}) => {
    const { setSwap, swap } = usePayContext();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { signer, getGasAbstractionSigner } = useWeb3Signer();

    const expectedChainId = () =>
        config.assets?.[props.oft.sourceAsset]?.network?.chainId;

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);
    const [hasEnoughMsgFee, setHasEnoughMsgFee] =
        createSignal<boolean>(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [approvalTarget, setApprovalTarget] = createSignal<string>(undefined);
    const txSent = createMemo(() => {
        return swap()?.oft?.txHash;
    });

    const [signerChainId] = createResource(signer, async (currentSigner) => {
        return await currentSigner.provider
            .getNetwork()
            .then((n) => Number(n.chainId));
    });

    const sourceWalletReady = () =>
        signer() !== undefined && signerChainId() === expectedChainId();

    createEffect(() => {
        if (signer() === undefined || signerChainId() !== expectedChainId()) {
            return;
        }

        void (async () => {
            const oftRoute = {
                from: props.oft.sourceAsset,
                to: props.oft.destinationAsset,
            };
            const oftContract = await getOftContract(oftRoute);

            const connectedSigner = signer();
            const signerAddress = await connectedSigner.getAddress();
            const recipient = getGasAbstractionSigner(
                props.oft.destinationAsset,
            ).address;
            const tokenContract = createTokenContract(
                props.oft.sourceAsset,
                connectedSigner,
            );
            const oftInstance = createOftContract(
                oftContract.address,
                connectedSigner,
            );
            const quotedOftInstance = await getQuotedOftContract(oftRoute);
            const [balance, approvalRequired, nativeBalance, { msgFee }] =
                await Promise.all([
                    tokenContract.balanceOf(signerAddress),
                    oftInstance.approvalRequired(),
                    connectedSigner.provider.getBalance(signerAddress),
                    quoteOftSend(
                        quotedOftInstance,
                        oftRoute,
                        recipient,
                        props.amount,
                    ),
                ]);

            // Some buffer to pay for gas
            const requiredNativeBalance =
                (msgFee[0] * BigInt(110)) / BigInt(100);

            let needsApproval = false;
            if (approvalRequired) {
                const allowance = await tokenContract.allowance(
                    signerAddress,
                    oftContract.address,
                );
                needsApproval = allowance < props.amount;
            }

            const hasEnoughTokenBalance = balance >= props.amount;
            const hasEnoughNativeBalanceForMsgFee =
                nativeBalance >= requiredNativeBalance;

            log.info("OFT signer token balance check", {
                asset: props.oft.sourceAsset,
                balance: balance.toString(),
                requiredAmount: props.amount.toString(),
                sufficient: hasEnoughTokenBalance,
            });
            log.info("OFT signer native balance check", {
                asset: props.oft.sourceAsset,
                destinationAsset: props.oft.destinationAsset,
                nativeBalance: nativeBalance.toString(),
                requiredMsgFee: requiredNativeBalance.toString(),
                sufficient: hasEnoughNativeBalanceForMsgFee,
            });

            setSignerBalance(balance);
            setHasEnoughMsgFee(hasEnoughNativeBalanceForMsgFee);
            setNeedsApproval(needsApproval);
            setApprovalTarget(
                approvalRequired ? oftContract.address : undefined,
            );
        })();
    });

    return (
        <Show
            when={txSent() === undefined}
            fallback={
                <WaitForOft
                    asset={props.oft.sourceAsset}
                    transactionHash={txSent()}
                />
            }>
            <Show
                when={
                    signerBalance() !== undefined &&
                    hasEnoughMsgFee() !== undefined
                }
                fallback={
                    <Show
                        when={sourceWalletReady()}
                        fallback={
                            <ConnectWallet asset={props.oft.sourceAsset} />
                        }>
                        <LoadingSpinner />
                    </Show>
                }>
                <Show
                    when={signerBalance() >= props.amount}
                    fallback={
                        <InsufficientBalance asset={props.oft.sourceAsset} />
                    }>
                    <Show
                        when={hasEnoughMsgFee()}
                        fallback={
                            <InsufficientBalance
                                asset={props.oft.sourceAsset}
                            />
                        }>
                        <Show
                            when={!needsApproval()}
                            fallback={
                                <ApproveErc20
                                    asset={props.oft.sourceAsset}
                                    value={() => props.amount}
                                    signerAddress={props.signerAddress}
                                    derivationPath={props.derivationPath}
                                    setNeedsApproval={setNeedsApproval}
                                    approvalTarget={approvalTarget()}
                                    resetAllowanceFirst={true}
                                />
                            }>
                            <ContractTransaction
                                asset={props.oft.sourceAsset}
                                /* eslint-disable-next-line solid/reactivity */
                                onClick={async () => {
                                    const connectedSigner = signer();
                                    const recipient = getGasAbstractionSigner(
                                        props.oft.destinationAsset,
                                    ).address;
                                    log.debug(
                                        `Sending OFT ${props.oft.destinationAsset} to ${recipient}`,
                                    );
                                    const oftRoute = {
                                        from: props.oft.sourceAsset,
                                        to: props.oft.destinationAsset,
                                    };
                                    const oftContract =
                                        await getOftContract(oftRoute);

                                    const quotedOftInstance =
                                        await getQuotedOftContract(oftRoute);
                                    const oftInstance = createOftContract(
                                        oftContract.address,
                                        connectedSigner,
                                    );
                                    const { sendParam, msgFee } =
                                        await quoteOftSend(
                                            quotedOftInstance,
                                            oftRoute,
                                            recipient,
                                            props.amount,
                                        );
                                    log.debug("Quoted OFT send", {
                                        swapId: props.swapId,
                                        sourceAsset: props.oft.sourceAsset,
                                        destinationAsset:
                                            props.oft.destinationAsset,
                                        recipient,
                                        amount: props.amount.toString(),
                                        nativeFee: msgFee[0].toString(),
                                        lzTokenFee: msgFee[1].toString(),
                                    });
                                    const tx = await oftInstance.send(
                                        sendParam,
                                        msgFee,
                                        await signer().getAddress(),
                                        {
                                            value: msgFee[0],
                                        },
                                    );

                                    const currentSwap = await getSwap(
                                        props.swapId,
                                    );
                                    if (currentSwap.oft !== undefined) {
                                        currentSwap.oft = {
                                            ...currentSwap.oft,
                                            txHash: tx.hash,
                                        };
                                    }

                                    setSwap(currentSwap);
                                    await setSwapStorage(currentSwap);
                                    log.info(
                                        "Persisted OFT send tx hash for background worker",
                                        {
                                            swapId: props.swapId,
                                            sourceAsset: props.oft.sourceAsset,
                                            destinationAsset:
                                                props.oft.destinationAsset,
                                            txHash: tx.hash,
                                        },
                                    );
                                }}
                                children={
                                    <ConnectWallet
                                        asset={props.oft.sourceAsset}
                                    />
                                }
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
                    </Show>
                </Show>
            </Show>
        </Show>
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
                    const connectedSigner = signer();
                    if (connectedSigner === undefined) {
                        throw new Error(
                            "connected signer is required for lockup",
                        );
                    }

                    let transactionHash: string;
                    const transactionSigner = getSignerForGasAbstraction(
                        props.gasAbstraction,
                        connectedSigner,
                        getGasAbstractionSigner(props.asset),
                    );

                    if (props.hops !== undefined && props.hops.length > 0) {
                        transactionHash = await lockupWithHops(
                            props.hops,
                            props.gasAbstraction,
                            props.asset,
                            props.swapId,
                            props.value(),
                            connectedSigner,
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
                                connectedSigner,
                                transactionSigner,
                            );
                        }
                    }

                    const currentSwap = await getSwap(props.swapId);
                    currentSwap.lockupTx = transactionHash;
                    currentSwap.signer = await connectedSigner.getAddress();

                    if (
                        customDerivationPathRdns.includes(connectedSigner.rdns)
                    ) {
                        currentSwap.derivationPath = (
                            providers()[connectedSigner.rdns]
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
    oft?: OftDetail;
}) => {
    const { slippage } = useGlobalContext();
    const { getErc20Swap, signer } = useWeb3Signer();

    const value = () => satsToAssetAmount(props.amount, props.asset);

    const hasHopsBefore = () =>
        props.hops !== undefined && props.hops.length > 0;

    // The actual asset the user needs to hold (hop input token or boltz asset)
    const userAsset = () =>
        hasHopsBefore() ? props.hops[0].from : props.asset;

    const expectedChainId = () =>
        config.assets?.[props.asset]?.network?.chainId;

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [requiredValue, setRequiredValue] = createSignal<bigint>(0n);
    const [approvalTarget, setApprovalTarget] = createSignal<string>(undefined);
    const [oftValue, setOftValue] = createSignal<bigint>(undefined);

    const [signerChainId] = createResource(signer, async (currentSigner) => {
        return await currentSigner.provider
            .getNetwork()
            .then((n) => Number(n.chainId));
    });

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (props.oft !== undefined) {
            setOftValue(
                (await getHopExecutionQuote(props.hops[0], value(), slippage()))
                    .amountIn,
            );
            return;
        }

        if (signer() === undefined) {
            return;
        }

        if (signerChainId() === undefined) {
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
                when={props.oft === undefined}
                fallback={
                    <Show
                        when={oftValue() !== undefined}
                        fallback={<LoadingSpinner />}>
                        <SendToOft
                            oft={props.oft}
                            swapId={props.swapId}
                            signerAddress={props.signerAddress}
                            derivationPath={props.derivationPath}
                            amount={oftValue()}
                        />
                    </Show>
                }>
                <Show
                    when={signerBalance() !== undefined}
                    fallback={
                        <Show
                            when={
                                signer() !== undefined &&
                                signerChainId() === expectedChainId()
                            }
                            fallback={<ConnectWallet asset={props.asset} />}>
                            <LoadingSpinner />
                        </Show>
                    }>
                    <Show
                        when={signerBalance() >= requiredValue()}
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
            </Show>
        </>
    );
};

export default LockupEvm;
