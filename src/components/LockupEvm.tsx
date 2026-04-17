import { abi as ERC20Abi } from "boltz-core/out/ERC20.sol/ERC20.json";
import { randomBytes } from "crypto";
import {
    AbiCoder,
    Interface,
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
    isTrustWalletIOSSigner,
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
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    GasAbstractionType,
    type OftDetail,
    type SomeSwap,
} from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";
import OptimizedRoute from "./OptimizedRoute";
import SendToOft from "./SendToOft";

const lockupGasUsage = 46_000n;

const erc20Interface = new Interface(ERC20Abi);

const buildTransferFromCall = (
    asset: string,
    ownerAddress: string,
    routerAddress: string,
    amount: bigint,
) => ({
    target: getTokenAddress(asset),
    value: 0n,
    callData: erc20Interface.encodeFunctionData("transferFrom", [
        ownerAddress,
        routerAddress,
        amount,
    ]),
});

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

const getRouterApprovalTarget = async (
    asset: string,
    signer: Signer,
): Promise<string> => {
    const router = createRouterContract(asset, signer);
    return isTrustWalletIOSSigner(signer)
        ? await router.getAddress()
        : ((await router.PERMIT2()) as string);
};

const permit2Types = {
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
};

const permit2DeadlineSeconds = 1_800;

const newPermit2Nonce = () => BigInt("0x" + randomBytes(32).toString("hex"));

const newPermit2Deadline = () =>
    BigInt(Math.floor(Date.now() / 1000) + permit2DeadlineSeconds);

const lockupErc20 = async ({
    gasAbstraction,
    asset,
    amount,
    preimageHash,
    claimAddress,
    timeoutBlockHeight,
    signer,
    transactionSigner,
    usePermit2,
}: {
    gasAbstraction: GasAbstractionType;
    asset: string;
    amount: bigint;
    preimageHash: string;
    claimAddress: string;
    timeoutBlockHeight: number;
    signer: Signer;
    transactionSigner: Signer | Wallet;
    usePermit2: boolean;
}): Promise<string> => {
    const router = createRouterContract(asset, transactionSigner);
    const [routerAddress, refundAddress] = await Promise.all([
        router.getAddress(),
        signer.getAddress(),
    ]);
    const tokenAddress = getTokenAddress(asset);

    if (!usePermit2) {
        const tx = await router.executeAndLockERC20.populateTransaction(
            prefix0x(preimageHash),
            tokenAddress,
            claimAddress,
            refundAddress,
            timeoutBlockHeight,
            [
                buildTransferFromCall(
                    asset,
                    refundAddress,
                    routerAddress,
                    amount,
                ),
            ],
        );
        return await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx,
        );
    }

    const calls: {
        target: string;
        value: string | bigint;
        callData: string;
    }[] = [];
    const callsHash = hashRouterCalls(calls);

    const [permit2Address, chainId] = await Promise.all([
        router.PERMIT2(),
        transactionSigner.provider
            .getNetwork()
            .then((network) => network.chainId),
    ]);

    const nonce = newPermit2Nonce();
    const deadline = newPermit2Deadline();

    const permit2Signature = await signer.signTypedData(
        {
            name: "Permit2",
            verifyingContract: permit2Address,
            chainId,
        },
        permit2Types,
        {
            permitted: { token: tokenAddress, amount },
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
            permitted: { token: tokenAddress, amount },
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

const lockupWithHops = async ({
    hops,
    gasAbstraction,
    asset,
    swapId,
    lockupAmount,
    connectedSigner,
    getGasAbstractionSigner,
    slippage,
    getSwap,
    setSwap,
    setSwapStorage,
    usePermit2,
}: {
    hops: EncodedHop[];
    gasAbstraction: GasAbstractionType;
    asset: string;
    swapId: string;
    lockupAmount: bigint;
    connectedSigner: Signer;
    getGasAbstractionSigner: (asset: string) => Wallet;
    slippage: number;
    getSwap: (id: string) => Promise<SomeSwap>;
    setSwap: Setter<SomeSwap | null>;
    setSwapStorage: (swap: SomeSwap) => Promise<void>;
    usePermit2: boolean;
}): Promise<string> => {
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

        const ownerAddress = await connectedSigner.getAddress();
        const refundAddress = transactionSigner.address;
        const tokenAddress = getTokenAddress(asset);
        const commitmentLockupDetails = await getCommitmentLockupDetails(asset);
        const commitmentPreimageHash = "00".repeat(32);

        const hopCalls = calldata.calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        }));
        const calls = usePermit2
            ? hopCalls
            : [
                  buildTransferFromCall(
                      hop.from,
                      ownerAddress,
                      routerAddress,
                      amountIn,
                  ),
                  ...hopCalls,
              ];

        let tx;
        if (usePermit2) {
            const [permit2Address, chainId] = await Promise.all([
                router.PERMIT2(),
                transactionSigner.provider.getNetwork().then((n) => n.chainId),
            ]);
            const callsHash = hashRouterCalls(calls);
            const nonce = newPermit2Nonce();
            const deadline = newPermit2Deadline();

            const permit2Signature = await connectedSigner.signTypedData(
                {
                    name: "Permit2",
                    verifyingContract: permit2Address,
                    chainId,
                },
                permit2Types,
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
                        refundAddress,
                        timelock: commitmentLockupDetails.timelock,
                        callsHash,
                    },
                },
            );

            tx =
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
        } else {
            tx = await router.executeAndLockERC20.populateTransaction(
                prefix0x(commitmentPreimageHash),
                tokenAddress,
                commitmentLockupDetails.claimAddress,
                refundAddress,
                commitmentLockupDetails.timelock,
                calls,
            );
        }

        log.info("Broadcasting commitment lockup with hops", {
            swapId,
            asset,
            gasAbstraction,
            amountIn: amountIn.toString(),
            targetLockupAmount: targetLockupAmount.toString(),
            routerAddress,
            usePermit2,
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

const LockupTransaction = (props: {
    asset: string;
    gasAbstraction: GasAbstractionType;
    value: () => bigint;
    preimageHash: string;
    claimAddress: string;
    timeoutBlockHeight: number;
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
                        transactionHash = await lockupWithHops({
                            hops: props.hops,
                            gasAbstraction: props.gasAbstraction,
                            asset: props.asset,
                            swapId: props.swapId,
                            lockupAmount: props.value(),
                            connectedSigner,
                            getGasAbstractionSigner,
                            slippage: slippage(),
                            getSwap,
                            setSwap,
                            setSwapStorage,
                            usePermit2:
                                props.gasAbstraction !==
                                    GasAbstractionType.None &&
                                !isTrustWalletIOSSigner(connectedSigner),
                        });
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
                            transactionHash = await lockupErc20({
                                gasAbstraction: props.gasAbstraction,
                                asset: props.asset,
                                amount: props.value(),
                                preimageHash: props.preimageHash,
                                claimAddress: props.claimAddress,
                                timeoutBlockHeight: props.timeoutBlockHeight,
                                signer: connectedSigner,
                                transactionSigner,
                                usePermit2:
                                    !isTrustWalletIOSSigner(connectedSigner),
                            });
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

    createEffect(() => {
        void (async () => {
            if (props.oft !== undefined) {
                setOftValue(
                    (
                        await getHopExecutionQuote(
                            props.hops[0],
                            value(),
                            slippage(),
                        )
                    ).amountIn,
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
                const hopInputContract = createTokenContract(
                    hop.from,
                    signer(),
                );
                const [approvalTarget, signerAddress] = await Promise.all([
                    getRouterApprovalTarget(hop.from, signer()),
                    signer().getAddress(),
                ]);

                const [balance, allowance, requiredValue] = await Promise.all([
                    hopInputContract.balanceOf(signerAddress),
                    hopInputContract.allowance(signerAddress, approvalTarget),
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
                setNeedsApproval(allowance < requiredValue);
                setApprovalTarget(approvalTarget);

                return;
            }

            switch (getKindForAsset(props.asset)) {
                case AssetKind.EVMNative: {
                    const [balance, gasPrice] = await Promise.all([
                        signer().provider.getBalance(
                            await signer().getAddress(),
                        ),
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

                    const approvalTarget =
                        props.gasAbstraction !== GasAbstractionType.None
                            ? await getRouterApprovalTarget(
                                  props.asset,
                                  signer(),
                              )
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
        })();
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
