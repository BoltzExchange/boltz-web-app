import { bridgeRegistry, vFromSignature } from "boltz-swaps/bridge";
import {
    encodeDexQuote,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "boltz-swaps/client";
import { type AlchemyCall, prefix0x, toAlchemyCall } from "boltz-swaps/evm";
import { resolveErc20SwapAbi, resolveEtherSwapAbi } from "boltz-swaps/evm/abis";
import {
    getEvmRefundCooperativeSignature,
    isEmptyPreimageHash,
} from "boltz-swaps/evm/commitment";
import {
    type Erc20SwapContract,
    type EtherSwapContract,
    createRouterContract,
} from "boltz-swaps/evm/contracts";
import { getTimelockBlockNumber } from "boltz-swaps/evm/logs";
import {
    type PopulatedEvmTransaction,
    getLockupEvent,
    getSignerForGasAbstraction,
} from "boltz-swaps/evm/transaction";
import {
    erc20Abi,
    erc20SwapAbi,
    etherSwapAbi,
} from "boltz-swaps/generated/evm-abis";
import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "boltz-swaps/helper";
import {
    AssetKind,
    type LockupEvent,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import log from "loglevel";
import {
    type Accessor,
    Match,
    type Setter,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    untrack,
} from "solid-js";
import {
    type Hash,
    type Hex,
    type Signature,
    type TransactionRequest,
    encodeFunctionData,
    getAddress,
    parseSignature,
    zeroAddress,
} from "viem";

import RefundEta from "../components/RefundEta";
import { config } from "../config";
import { type AssetType, getKindForAsset, isEvmAsset } from "../consts/Assets";
import { type deriveKeyFn, useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { type Signer, useWeb3Signer } from "../context/Web3";
import { useModifySwap } from "../hooks/useModifySwap";
import { validateAddress } from "../utils/compat";
import { formatError } from "../utils/errors";
import { sendPopulatedTransaction } from "../utils/evmTransaction";
import { RefundType, refund } from "../utils/rescue";
import {
    type BridgeDetail,
    type ChainSwap,
    type CommitmentSwap,
    type DexDetail,
    GasAbstractionType,
    type SubmarineSwap,
    getLockupGasAbstraction,
} from "../utils/swapCreator";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";

export const incorrectAssetError = "incorrect asset was sent";

export const sendRefundTransaction = async (
    gasAbstraction: GasAbstractionType,
    transactionSigner: Signer,
    asset: AssetType,
    timeoutBlockHeight: number,
    refundCooperative: () => Promise<TransactionRequest | AlchemyCall[]>,
    refundTimeout: () => Promise<TransactionRequest | AlchemyCall[]>,
): Promise<string> => {
    const provider = transactionSigner.provider;
    let transactionHash: Hash;

    try {
        const tx = await refundCooperative();
        transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx as PopulatedEvmTransaction | AlchemyCall[],
        );
    } catch (cooperativeError) {
        const currentBlock = await getTimelockBlockNumber(provider, asset);
        if (timeoutBlockHeight >= currentBlock) {
            throw cooperativeError;
        }
        log.warn(
            "cooperative refund failed, falling back to timeout refund",
            cooperativeError,
        );
        const tx = await refundTimeout();
        transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx as PopulatedEvmTransaction | AlchemyCall[],
        );
    }

    await provider.waitForTransactionReceipt({
        hash: transactionHash as Hash,
        confirmations: 1,
    });
    return transactionHash;
};

export const resolveBridgeSender = async (
    bridge: BridgeDetail,
): Promise<string> => {
    if (bridge.txHash === undefined) {
        throw new Error(
            "missing bridge transaction hash for pre-bridge refund",
        );
    }

    const forwardDriver = bridgeRegistry.requireDriverForRoute(bridge);
    const sender = await forwardDriver.getTransactionSender(
        bridge.sourceAsset,
        bridge.txHash,
    );
    if (sender === undefined) {
        throw new Error(
            `could not resolve original sender from bridge transaction: ${bridge.txHash}`,
        );
    }

    return sender;
};

export const buildReverseBridgeCalls = async ({
    transactionSigner,
    bridge,
    recipient,
    sourceToken,
    amount,
    quoteChain,
    refundAddress,
    slippage,
    trade,
}: {
    transactionSigner: Signer;
    bridge: BridgeDetail;
    recipient: string;
    sourceToken: string;
    amount: bigint;
    quoteChain: string;
    refundAddress: string;
    slippage: number;
    trade?: { desiredToken: string };
}): Promise<AlchemyCall[]> => {
    const route = {
        sourceAsset: bridge.destinationAsset,
        destinationAsset: bridge.sourceAsset,
    };
    const driver = bridgeRegistry.requireDriverForRoute(route);
    const router = createRouterContract(route.sourceAsset, transactionSigner);
    const [bridgeContract, quotedBridge] = await Promise.all([
        driver.getContract(route),
        driver.getQuotedContract(route),
    ]);

    const fetchTradeQuote = async (amountIn: bigint, toToken: string) => {
        const [quote] = await quoteDexAmountIn(
            quoteChain,
            sourceToken,
            toToken,
            amountIn,
        );
        if (quote === undefined) {
            throw new Error("could not get DEX quote for refund");
        }
        return quote;
    };

    const feeQuoteAmount =
        trade === undefined
            ? amount
            : BigInt((await fetchTradeQuote(amount, trade.desiredToken)).quote);
    const { msgFee } = await driver.quoteSend(
        quotedBridge,
        route,
        recipient,
        feeQuoteAmount,
    );

    let postFeeAmount = amount;
    let msgFeeCalls: AlchemyCall[] = [];
    if (msgFee[0] > 0n) {
        const msgFeeAmountOut = calculateAmountWithSlippage(
            msgFee[0],
            slippage,
        );
        const [msgFeeQuote] = await quoteDexAmountOut(
            quoteChain,
            sourceToken,
            zeroAddress,
            msgFeeAmountOut,
        );
        if (msgFeeQuote === undefined) {
            throw new Error("could not get DEX quote for bridge messaging fee");
        }

        postFeeAmount -= BigInt(msgFeeQuote.quote);
        if (postFeeAmount <= 0n) {
            throw new Error("amount too small to cover bridge messaging fee");
        }

        const msgFeeCalldata = await encodeDexQuote(
            quoteChain,
            router.address,
            BigInt(msgFeeQuote.quote),
            msgFee[0],
            msgFeeQuote.data,
        );
        msgFeeCalls = msgFeeCalldata.calls.map((call) => ({
            to: call.to,
            value: call.value,
            data: call.data,
        }));
    }

    let approvalAmount = postFeeAmount;
    let bridgeAmount = postFeeAmount;
    let tradeCalls: AlchemyCall[] = [];
    if (trade !== undefined) {
        const tradeQuote = await fetchTradeQuote(
            postFeeAmount,
            trade.desiredToken,
        );
        approvalAmount = BigInt(tradeQuote.quote);
        bridgeAmount = calculateAmountOutMin(approvalAmount, slippage);
        const tradeCalldata = await encodeDexQuote(
            quoteChain,
            router.address,
            postFeeAmount,
            bridgeAmount,
            tradeQuote.data,
        );
        tradeCalls = tradeCalldata.calls.map((call) => ({
            to: call.to,
            value: call.value,
            data: call.data,
        }));
    }

    const routerCalls = [...tradeCalls, ...msgFeeCalls].map((call) => ({
        target: call.to,
        value: call.value ?? "0",
        callData: prefix0x(call.data ?? "0x"),
    }));

    const approvalCall = await driver.buildApprovalCall(
        route,
        router.address,
        approvalAmount,
        transactionSigner,
    );
    if (approvalCall !== undefined) {
        routerCalls.push({
            target: approvalCall.to,
            value: approvalCall.value ?? "0",
            callData: prefix0x(approvalCall.data ?? "0x"),
        });
    }

    const { sendParam, minAmount } = await driver.quoteSend(
        quotedBridge,
        route,
        recipient,
        bridgeAmount,
    );
    const minAmountLd = calculateAmountOutMin(minAmount, slippage);
    const executeBridgeData = driver.encodeRouterExecuteData({
        router,
        route,
        bridgeContract,
        routerCalls,
        sendParam,
        minAmountLd,
        lzTokenFee: msgFee[1],
        refundAddress,
    });

    return [
        {
            to: getAddress(sourceToken),
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [getAddress(router.address), amount],
            }),
        },
        {
            to: router.address,
            data: executeBridgeData,
        },
    ];
};

const buildRefundFollowUpCalls = async (
    transactionSigner: Signer,
    refundData: LockupEvent,
    slippage: number,
    dexDetails?: DexDetail,
    destination?: string,
    bridge?: BridgeDetail,
) => {
    let resolvedDestination = destination;
    const isPreBridge = bridge?.position === SwapPosition.Pre;

    if (isPreBridge) {
        if (
            dexDetails === undefined ||
            dexDetails.position !== SwapPosition.Pre
        ) {
            throw new Error(
                "missing reverse DEX details for pre-bridge refund",
            );
        }

        resolvedDestination = await resolveBridgeSender(bridge);
    }

    if (dexDetails === undefined || dexDetails.position !== SwapPosition.Pre) {
        return undefined;
    }

    if (resolvedDestination === undefined) {
        throw new Error("missing refund destination for routed refund");
    }

    const hopDexDetails = dexDetails.hops[0].dexDetails;
    if (hopDexDetails === undefined) {
        throw new Error("missing DEX details on refund hop");
    }
    const desiredToken = hopDexDetails.tokenIn;
    const quoteChain = hopDexDetails.chain;
    if (refundData.tokenAddress === undefined) {
        throw new Error("missing token address for refund");
    }

    if (!isPreBridge) {
        const [quote] = await quoteDexAmountIn(
            quoteChain,
            refundData.tokenAddress,
            desiredToken,
            refundData.amount,
        );
        if (quote === undefined) {
            throw new Error("could not get DEX quote for refund");
        }
        const amountOutMin = calculateAmountOutMin(
            BigInt(quote.quote),
            slippage,
        );

        log.debug(`Refunding via DEX to ${desiredToken}`);
        const calldata = await encodeDexQuote(
            quoteChain,
            resolvedDestination,
            refundData.amount,
            amountOutMin,
            quote.data,
        );
        return calldata.calls.map((call) => ({
            to: call.to,
            value: call.value,
            data: call.data,
        }));
    }

    log.debug(`Refunding via DEX and bridge to ${resolvedDestination}`);
    return buildReverseBridgeCalls({
        transactionSigner,
        bridge,
        recipient: resolvedDestination,
        sourceToken: refundData.tokenAddress,
        amount: refundData.amount,
        quoteChain,
        refundAddress: refundData.refundAddress,
        slippage,
        trade: { desiredToken },
    });
};

const buildErc20RefundTransaction = async ({
    gasAbstraction,
    transactionSigner,
    contract,
    refundData,
    signature,
    slippage,
    dexDetails,
    destination,
    bridge,
    cooperative,
    commitmentRefund = false,
}: {
    gasAbstraction: GasAbstractionType;
    transactionSigner: Signer;
    contract: Erc20SwapContract;
    refundData: LockupEvent;
    signature?: Signature;
    slippage: number;
    dexDetails?: DexDetail;
    destination?: string;
    bridge?: BridgeDetail;
    cooperative: boolean;
    commitmentRefund?: boolean;
}): Promise<TransactionRequest | AlchemyCall[]> => {
    if (refundData.tokenAddress === undefined) {
        throw new Error("missing token address for ERC20 refund");
    }

    if (cooperative && signature === undefined) {
        throw new Error("missing cooperative refund signature");
    }

    const refundTransaction: TransactionRequest = {
        to: contract.address,
        data: cooperative
            ? commitmentRefund
                ? encodeFunctionData({
                      abi: erc20SwapAbi,
                      functionName: "refundCooperative",
                      args: [
                          refundData.preimageHash as Hex,
                          refundData.amount,
                          getAddress(refundData.tokenAddress),
                          getAddress(refundData.claimAddress),
                          refundData.timelock,
                          vFromSignature(signature!),
                          signature!.r,
                          signature!.s,
                      ],
                  })
                : encodeFunctionData({
                      abi: erc20SwapAbi,
                      functionName: "refundCooperative",
                      args: [
                          refundData.preimageHash as Hex,
                          refundData.amount,
                          getAddress(refundData.tokenAddress),
                          getAddress(refundData.claimAddress),
                          getAddress(refundData.refundAddress),
                          refundData.timelock,
                          vFromSignature(signature!),
                          signature!.r,
                          signature!.s,
                      ],
                  })
            : encodeFunctionData({
                  abi: erc20SwapAbi,
                  functionName: "refund",
                  args: [
                      refundData.preimageHash as Hex,
                      refundData.amount,
                      getAddress(refundData.tokenAddress),
                      getAddress(refundData.claimAddress),
                      getAddress(refundData.refundAddress),
                      refundData.timelock,
                  ],
              }),
    };

    if (gasAbstraction !== GasAbstractionType.Signer) {
        return refundTransaction;
    }

    const followUpCalls = await buildRefundFollowUpCalls(
        transactionSigner,
        refundData,
        slippage,
        dexDetails,
        destination,
        bridge,
    );

    if (followUpCalls !== undefined) {
        return [toAlchemyCall(refundTransaction), ...followUpCalls];
    }

    if (
        destination !== undefined &&
        getAddress(destination) === getAddress(refundData.refundAddress)
    ) {
        return [toAlchemyCall(refundTransaction)];
    }

    if (destination && refundData.tokenAddress) {
        return [
            toAlchemyCall(refundTransaction),
            {
                to: refundData.tokenAddress,
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [getAddress(destination), refundData.amount],
                }),
            },
        ];
    }

    return refundTransaction;
};

export const RefundEvm = (props: {
    asset: string;
    gasAbstraction?: GasAbstractionType;
    transactionSigner?: Signer;
    disabled?: boolean;
    swapId?: string;
    signerAddress?: string;
    derivationPath?: string;
    swapType?: SwapType;
    lockupTxHash?: string;
    commitmentLockupTxHash?: string;
    setRefundTxId: Setter<string | undefined>;
    dexDetails?: DexDetail;
    destination?: string;
    bridge?: BridgeDetail;
}) => {
    const {
        getErc20Swap,
        getEtherSwap,
        getSwapContractVersion,
        signer,
        getGasAbstractionSigner,
    } = useWeb3Signer();
    const { t, slippage } = useGlobalContext();

    const gasAbstraction = createMemo(
        () => props.gasAbstraction ?? GasAbstractionType.None,
    );
    const transactionSigner = createMemo<Signer | undefined>(() => {
        if (props.transactionSigner) {
            return props.transactionSigner;
        }
        return getSignerForGasAbstraction(
            gasAbstraction(),
            signer(),
            getGasAbstractionSigner(props.asset),
        );
    });

    const [signerNetwork, setSignerNetwork] = createSignal<number | undefined>(
        undefined,
    );

    createEffect(() => {
        const ts = transactionSigner();
        if (ts === undefined) {
            setSignerNetwork(undefined);
            return;
        }
        void ts.provider
            .getChainId()
            .then((chainId) => setSignerNetwork(Number(chainId)))
            .catch(() => setSignerNetwork(undefined));
    });

    const networkValid = (): boolean | undefined => {
        const expected = config.assets?.[props.asset]?.network?.chainId;
        if (expected === undefined) {
            return true;
        }
        if (signerNetwork() === undefined) {
            return undefined;
        }
        return expected === signerNetwork();
    };

    const contractKind = createMemo(() => getKindForAsset(props.asset));
    const refundDataTrigger = createMemo<
        | {
              asset: string;
              lockupTx?: string;
              commitmentLockupTxHash?: string;
              contractKind: AssetKind;
              transactionSigner: Signer;
          }
        | undefined
    >(() => {
        const txSigner = transactionSigner();
        if (txSigner === undefined) {
            return undefined;
        }

        if (!networkValid()) {
            return undefined;
        }

        return {
            asset: props.asset,
            transactionSigner: txSigner,
            lockupTx: props.lockupTxHash,
            contractKind: contractKind(),
            commitmentLockupTxHash: props.commitmentLockupTxHash,
        };
    });

    const [refundData] = createResource(
        refundDataTrigger,
        async ({
            asset,
            lockupTx,
            commitmentLockupTxHash,
            contractKind,
            transactionSigner,
        }) => {
            const contract =
                contractKind === AssetKind.ERC20
                    ? getErc20Swap(asset)
                    : getEtherSwap(asset);

            log.debug("Fetching lockup data");
            const txHash = lockupTx ?? commitmentLockupTxHash;
            if (
                txHash === undefined ||
                txHash === null ||
                txHash === "" ||
                !txHash.startsWith("0x")
            ) {
                throw new Error(
                    "missing lockup or commitment transaction hash",
                );
            }
            const receipt =
                await transactionSigner.provider.getTransactionReceipt({
                    hash: txHash as Hash,
                });
            if (receipt === null) {
                throw new Error("could not fetch lockup transaction receipt");
            }

            const lockupAbi =
                contractKind === AssetKind.ERC20
                    ? resolveErc20SwapAbi(
                          getSwapContractVersion(asset, "ERC20Swap"),
                      )
                    : resolveEtherSwapAbi(
                          getSwapContractVersion(asset, "EtherSwap"),
                      );
            const data = getLockupEvent(lockupAbi, receipt, contract.address);

            let swapHash: Hex;
            if (contractKind === AssetKind.ERC20) {
                if (data.tokenAddress === undefined) {
                    throw new Error(
                        "missing token address in lockup data for ERC20 swap",
                    );
                }
                swapHash = await (
                    contract as Erc20SwapContract
                ).read.hashValues([
                    data.preimageHash as Hex,
                    data.amount,
                    getAddress(data.tokenAddress),
                    getAddress(data.claimAddress),
                    getAddress(data.refundAddress),
                    data.timelock,
                ]);
            } else {
                swapHash = await (
                    contract as EtherSwapContract
                ).read.hashValues([
                    data.preimageHash as Hex,
                    data.amount,
                    getAddress(data.claimAddress),
                    getAddress(data.refundAddress),
                    data.timelock,
                ]);
            }

            const stillLocked = await contract.read.swaps([swapHash]);
            log.debug("Funds still locked", stillLocked);

            return {
                stillLocked,
                ...data,
            };
        },
    );

    return (
        <Switch>
            <Match when={refundDataTrigger() === undefined}>
                <ConnectWallet
                    asset={props.asset}
                    derivationPath={props.derivationPath}
                    addressOverride={() => props.signerAddress}
                />
            </Match>
            <Match when={refundData.loading}>
                <LoadingSpinner />
            </Match>
            <Match when={refundData.state === "errored"}>
                <h2>{t("error")}</h2>
                <h3>{formatError(refundData.error)}</h3>
            </Match>
            <Match
                when={
                    refundData.state === "ready" && !refundData().stillLocked
                }>
                <h3>{t("already_refunded")}</h3>
            </Match>
            <Match
                when={refundData.state === "ready" && refundData().stillLocked}>
                <ContractTransaction
                    address={{
                        address:
                            transactionSigner()?.address ??
                            props.signerAddress ??
                            "",
                        derivationPath: props.derivationPath,
                    }}
                    disabled={props.disabled}
                    asset={props.asset}
                    signerOverride={transactionSigner}
                    /* eslint-disable-next-line solid/reactivity */
                    onClick={async () => {
                        const currentTransactionSigner = transactionSigner();
                        const currentRefundData = refundData();
                        if (
                            currentTransactionSigner === undefined ||
                            currentRefundData === undefined
                        ) {
                            throw new Error(
                                "could not prepare refund transaction",
                            );
                        }
                        const currentContractKind = contractKind();

                        const refundCooperative = async () => {
                            const isCommitmentLockup = isEmptyPreimageHash(
                                currentRefundData.preimageHash,
                            );

                            const signatureHex =
                                await getEvmRefundCooperativeSignature({
                                    isCommitmentLockup,
                                    asset: props.asset,
                                    swapId: props.swapId,
                                    swapType: props.swapType,
                                    commitmentTxHash:
                                        props.lockupTxHash ??
                                        props.commitmentLockupTxHash,
                                    logIndex: currentRefundData.logIndex,
                                    signer: currentTransactionSigner,
                                });
                            const decSignature = parseSignature(signatureHex);

                            if (currentContractKind === AssetKind.ERC20) {
                                const contract = getErc20Swap(props.asset);
                                return await buildErc20RefundTransaction({
                                    gasAbstraction: gasAbstraction(),
                                    transactionSigner: currentTransactionSigner,
                                    contract,
                                    refundData: currentRefundData,
                                    signature: decSignature,
                                    slippage: slippage(),
                                    dexDetails: props.dexDetails,
                                    destination: props.destination,
                                    bridge: props.bridge,
                                    cooperative: true,
                                    commitmentRefund: isCommitmentLockup,
                                });
                            }

                            const contract = getEtherSwap(props.asset);
                            if (isCommitmentLockup) {
                                return {
                                    to: contract.address,
                                    data: encodeFunctionData({
                                        abi: etherSwapAbi,
                                        functionName: "refundCooperative",
                                        args: [
                                            currentRefundData.preimageHash as Hex,
                                            currentRefundData.amount,
                                            getAddress(
                                                currentRefundData.claimAddress,
                                            ),
                                            currentRefundData.timelock,
                                            vFromSignature(decSignature),
                                            decSignature.r,
                                            decSignature.s,
                                        ],
                                    }),
                                };
                            }
                            return {
                                to: contract.address,
                                data: encodeFunctionData({
                                    abi: etherSwapAbi,
                                    functionName: "refundCooperative",
                                    args: [
                                        currentRefundData.preimageHash as Hex,
                                        currentRefundData.amount,
                                        getAddress(
                                            currentRefundData.claimAddress,
                                        ),
                                        getAddress(
                                            currentRefundData.refundAddress,
                                        ),
                                        currentRefundData.timelock,
                                        vFromSignature(decSignature),
                                        decSignature.r,
                                        decSignature.s,
                                    ],
                                }),
                            };
                        };

                        const refundTimeout = async () => {
                            if (currentContractKind === AssetKind.ERC20) {
                                const contract = getErc20Swap(props.asset);
                                return await buildErc20RefundTransaction({
                                    gasAbstraction: gasAbstraction(),
                                    transactionSigner: currentTransactionSigner,
                                    contract,
                                    refundData: currentRefundData,
                                    slippage: slippage(),
                                    dexDetails: props.dexDetails,
                                    destination: props.destination,
                                    bridge: props.bridge,
                                    cooperative: false,
                                });
                            }

                            const contract = getEtherSwap(props.asset);
                            return {
                                to: contract.address,
                                data: encodeFunctionData({
                                    abi: etherSwapAbi,
                                    functionName: "refund",
                                    args: [
                                        currentRefundData.preimageHash as Hex,
                                        currentRefundData.amount,
                                        getAddress(
                                            currentRefundData.claimAddress,
                                        ),
                                        getAddress(
                                            currentRefundData.refundAddress,
                                        ),
                                        currentRefundData.timelock,
                                    ],
                                }),
                            };
                        };

                        const transactionHash = await sendRefundTransaction(
                            gasAbstraction(),
                            currentTransactionSigner,
                            props.asset as AssetType,
                            Number(currentRefundData.timelock),
                            refundCooperative,
                            refundTimeout,
                        );
                        props.setRefundTxId(transactionHash);
                    }}
                    buttonText={t("refund")}
                />
            </Match>
        </Switch>
    );
};

export const RefundBtc = (props: {
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId: Setter<string>;
    buttonOverride?: string;
    deriveKeyFn?: deriveKeyFn;
}) => {
    const { setRefundAddress, refundAddress, notify, t, deriveKey } =
        useGlobalContext();
    const { refundableUTXOs, failureReason } = usePayContext();

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockheight, setTimeoutBlockheight] = createSignal<number>(0);

    const [valid, setValid] = createSignal<boolean>(false);
    const [refundRunning, setRefundRunning] = createSignal<boolean>(false);

    const validateRefundAddress = () => {
        if (!refundAddress()) {
            setValid(false);
            return;
        }

        const lockupAddress =
            props.swap().type === SwapType.Submarine
                ? (props.swap() as SubmarineSwap).address
                : (props.swap() as ChainSwap).lockupDetails.lockupAddress;

        if (refundAddress() === lockupAddress) {
            log.debug("refunds to lockup address are blocked");
            setValid(false);
            return;
        }

        const asset = props.swap()?.assetSend;
        if (!asset) return;
        const address = refundAddress();
        if (address === null) {
            setValid(false);
            return;
        }

        setValid(validateAddress(asset, address));
    };

    const refundAction = async () => {
        setRefundRunning(true);

        try {
            const address = refundAddress();
            if (address === null) {
                throw new Error("missing refund address");
            }
            const refundTxId = await refund(
                props.deriveKeyFn || deriveKey,
                props.swap(),
                address,
                refundableUTXOs(),
                failureReason() === incorrectAssetError
                    ? RefundType.AssetRescue
                    : RefundType.Cooperative,
            );

            props.setRefundTxId?.(refundTxId);

            setRefundAddress("");
        } catch (error) {
            log.warn("refund failed", error);
            if (typeof error === "string") {
                let msg = error;
                if (
                    msg === "bad-txns-inputs-missingorspent" ||
                    msg === "Transaction already in block chain" ||
                    msg.startsWith("insufficient fee")
                ) {
                    msg = t("already_refunded");
                } else if (
                    msg.endsWith("script-verify-flag-failed") ||
                    msg === "non-final"
                ) {
                    msg = t("locktime_not_satisfied");
                    const legacyTx = refundableUTXOs().find(
                        (tx) => tx.timeoutEta && tx.timeoutBlockHeight,
                    );
                    if (legacyTx) {
                        setTimeoutEta(legacyTx.timeoutEta ?? 0);
                        setTimeoutBlockheight(legacyTx.timeoutBlockHeight ?? 0);
                    }
                }
                log.error(msg);
                notify("error", msg);
            } else {
                log.error(formatError(error));
                notify("error", formatError(error));
            }
        }

        setRefundRunning(false);
    };

    const buttonMessage = createMemo(() => {
        if (refundableUTXOs()?.length === 0) {
            return t("no_lockup_transaction");
        }
        if (valid() || !refundAddress() || !props.swap()) {
            return t("refund");
        }
        return t("invalid_address", {
            asset: props.swap()?.assetSend ?? "",
        });
    });

    return (
        <Show when={refundableUTXOs()} fallback={<LoadingSpinner />}>
            <Show when={timeoutEta() > 0 || timeoutBlockheight() > 0}>
                <RefundEta
                    timeoutEta={timeoutEta}
                    timeoutBlockHeight={timeoutBlockheight}
                    asset={props.swap().assetSend}
                />
            </Show>
            <Show when={refundableUTXOs().length > 0}>
                <h3 style={{ color: "var(--color-text)" }}>
                    {props.swap()
                        ? t("refund_address_header", {
                              asset: props.swap()?.assetSend ?? "",
                          })
                        : t("refund_address_header_no_asset")}
                </h3>
                <input
                    data-testid="refundAddress"
                    id="refundAddress"
                    value={refundAddress() ?? ""}
                    onInput={(e) => {
                        setRefundAddress(e.target.value.trim());
                        validateRefundAddress();
                    }}
                    disabled={refundRunning()}
                    type="text"
                    name="refundAddress"
                    placeholder={
                        props.swap()
                            ? t("onchain_address", {
                                  asset: props.swap()?.assetSend ?? "",
                              })
                            : t("onchain_address_no_asset")
                    }
                />
            </Show>
            <Show
                when={!props.buttonOverride && refundableUTXOs().length === 0}>
                <p class="frame-text">{t("refresh_for_refund")}</p>
            </Show>
            <button
                data-testid="refundButton"
                class="btn"
                disabled={!valid() || refundRunning()}
                onClick={() => refundAction()}>
                {refundRunning() ? (
                    <LoadingSpinner class="inner-spinner" />
                ) : (
                    (props.buttonOverride ?? buttonMessage())
                )}
            </button>
        </Show>
    );
};

const RefundButton = (props: {
    swap: Accessor<SubmarineSwap | ChainSwap | CommitmentSwap>;
    setRefundTxId?: Setter<string>;
    buttonOverride?: string;
    deriveKeyFn?: deriveKeyFn;
}) => {
    const modifySwap = useModifySwap();

    const [refundTxId, setRefundTxId] = createSignal<string>("");

    createEffect(() => {
        const txId = refundTxId();
        if (txId === "") {
            return;
        }

        const currentSwap = untrack(props.swap);
        props.setRefundTxId?.(txId);
        void modifySwap(currentSwap.id, (s) => {
            s.refundTx = txId;
        });
    });
    return (
        <Show
            when={
                props.swap() === null ||
                props.swap() === undefined ||
                !isEvmAsset(props.swap().assetSend)
            }
            fallback={
                <RefundEvm
                    swapId={props.swap().id}
                    gasAbstraction={getLockupGasAbstraction(props.swap())}
                    signerAddress={props.swap().signer}
                    derivationPath={props.swap().derivationPath}
                    swapType={props.swap().type}
                    setRefundTxId={setRefundTxId as Setter<string | undefined>}
                    asset={props.swap().assetSend}
                    commitmentLockupTxHash={props.swap().commitmentLockupTxHash}
                    lockupTxHash={props.swap().lockupTx}
                    dexDetails={props.swap().dex}
                    destination={props.swap().signer}
                    bridge={props.swap().bridge}
                />
            }>
            <RefundBtc
                swap={props.swap as Accessor<SubmarineSwap | ChainSwap>}
                buttonOverride={props.buttonOverride}
                deriveKeyFn={props.deriveKeyFn}
                setRefundTxId={setRefundTxId}
            />
        </Show>
    );
};

export default RefundButton;
