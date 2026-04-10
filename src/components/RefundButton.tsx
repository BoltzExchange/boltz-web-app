import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import {
    Signature,
    type TransactionRequest,
    type Wallet,
    ZeroAddress,
    getAddress,
} from "ethers";
import log from "loglevel";
import type { Accessor, Setter } from "solid-js";
import {
    Match,
    Show,
    Switch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
} from "solid-js";

import { type AlchemyCall, prefixHex, toAlchemyCall } from "../alchemy/Alchemy";
import RefundEta from "../components/RefundEta";
import { config } from "../config";
import {
    AssetKind,
    type AssetType,
    getKindForAsset,
    isEvmAsset,
    requireTokenConfig,
} from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    type Signer,
    createRouterContract,
    useWeb3Signer,
} from "../context/Web3";
import {
    encodeDexQuote,
    getEipRefundSignature,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "../utils/boltzClient";
import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "../utils/calculate";
import { validateAddress } from "../utils/compat";
import { getTimelockBlockNumber } from "../utils/contractLogs";
import { formatError } from "../utils/errors";
import {
    type LockupEvent,
    assertTransactionSignerProvider,
    erc20TransferInterface,
    getLockupEvent,
    getSignerForGasAbstraction,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import {
    buildOftApprovalCall,
    getOftTransactionSender,
    getQuotedOftContract,
    quoteOftSend,
} from "../utils/oft/oft";
import { getOftContract } from "../utils/oft/registry";
import { createAssetProvider } from "../utils/provider";
import { RefundType, refund } from "../utils/rescue";
import {
    type ChainSwap,
    type DexDetail,
    GasAbstractionType,
    type OftDetail,
    type SubmarineSwap,
    getLockupGasAbstraction,
} from "../utils/swapCreator";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";

export const incorrectAssetError = "incorrect asset was sent";

export const sendRefundTransaction = async (
    gasAbstraction: GasAbstractionType,
    transactionSigner: Signer | Wallet,
    asset: AssetType,
    timeoutBlockHeight: number,
    refundCooperative: () => Promise<TransactionRequest | AlchemyCall[]>,
    refundTimeout: () => Promise<TransactionRequest | AlchemyCall[]>,
): Promise<string> => {
    const provider = assertTransactionSignerProvider(transactionSigner);
    let transactionHash: string;

    try {
        const tx = await refundCooperative();
        transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx,
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
            tx,
        );
    }

    await provider.waitForTransaction(transactionHash, 1);
    return transactionHash;
};

const buildRefundFollowUpCalls = async (
    transactionSigner: Signer | Wallet,
    refundData: LockupEvent,
    slippage: number,
    dexDetails?: DexDetail,
    destination?: string,
    oft?: OftDetail,
) => {
    let resolvedDestination = destination;

    if (oft?.position === SwapPosition.Pre) {
        if (oft.txHash === undefined) {
            throw new Error("missing OFT transaction hash for pre-OFT refund");
        }

        if (
            dexDetails === undefined ||
            dexDetails.position !== SwapPosition.Pre
        ) {
            throw new Error("missing reverse DEX details for pre-OFT refund");
        }

        const sender = await getOftTransactionSender(
            oft.sourceAsset,
            oft.txHash,
        );
        if (sender === undefined) {
            throw new Error(
                `could not resolve original sender from OFT transaction: ${oft.txHash}`,
            );
        }

        resolvedDestination = sender;
    }

    if (dexDetails === undefined || dexDetails.position !== SwapPosition.Pre) {
        return undefined;
    }

    if (resolvedDestination === undefined) {
        throw new Error("missing refund destination for routed refund");
    }

    const desiredToken = dexDetails.hops[0].dexDetails.tokenIn;
    const quoteChain = dexDetails.hops[0].dexDetails.chain;
    const [quote] = await quoteDexAmountIn(
        quoteChain,
        refundData.tokenAddress,
        desiredToken,
        refundData.amount,
    );
    if (quote === undefined) {
        throw new Error("could not get DEX quote for refund");
    }

    const quoteAmount = BigInt(quote.quote);
    const amountOutMin = calculateAmountOutMin(quoteAmount, slippage);
    const dexRecipient =
        oft?.position === SwapPosition.Pre
            ? refundData.refundAddress
            : resolvedDestination;

    log.debug(
        oft?.position === SwapPosition.Pre
            ? `Refunding via DEX and OFT to ${resolvedDestination}`
            : `Refunding via DEX to ${desiredToken}`,
    );

    if (oft?.position !== SwapPosition.Pre) {
        const calldata = await encodeDexQuote(
            quoteChain,
            dexRecipient,
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

    const route = {
        sourceAsset: oft.destinationAsset,
        destinationAsset: oft.sourceAsset,
    };
    const router = createRouterContract(route.sourceAsset, transactionSigner);
    const [routerAddress, oftContract, quotedOft] = await Promise.all([
        router.getAddress(),
        getOftContract(route),
        getQuotedOftContract(route),
    ]);
    const { msgFee } = await quoteOftSend(
        quotedOft,
        route,
        resolvedDestination,
        quoteAmount,
    );

    let tradeAmountIn = refundData.amount;
    let msgFeeCalls: AlchemyCall[] = [];
    if (msgFee[0] > 0n) {
        const msgFeeAmountOut = calculateAmountWithSlippage(
            msgFee[0],
            slippage,
        );
        const [msgFeeQuote] = await quoteDexAmountOut(
            quoteChain,
            refundData.tokenAddress,
            ZeroAddress,
            msgFeeAmountOut,
        );
        if (msgFeeQuote === undefined) {
            throw new Error("could not get DEX quote for OFT messaging fee");
        }

        const msgFeeAmountIn = BigInt(msgFeeQuote.quote);
        tradeAmountIn -= msgFeeAmountIn;
        if (tradeAmountIn <= 0n) {
            throw new Error("amount too small to cover OFT messaging fee");
        }

        const msgFeeCalldata = await encodeDexQuote(
            quoteChain,
            routerAddress,
            msgFeeAmountIn,
            msgFee[0],
            msgFeeQuote.data,
        );
        msgFeeCalls = msgFeeCalldata.calls.map((call) => ({
            to: call.to,
            value: call.value,
            data: call.data,
        }));
    }

    const [tradeQuote] = await quoteDexAmountIn(
        quoteChain,
        refundData.tokenAddress,
        desiredToken,
        tradeAmountIn,
    );
    if (tradeQuote === undefined) {
        throw new Error("could not get DEX quote for refund");
    }

    const tradeAmountOutMin = calculateAmountOutMin(
        BigInt(tradeQuote.quote),
        slippage,
    );
    const tradeCalldata = await encodeDexQuote(
        quoteChain,
        routerAddress,
        tradeAmountIn,
        tradeAmountOutMin,
        tradeQuote.data,
    );
    const tradeCalls: AlchemyCall[] = tradeCalldata.calls.map((call) => ({
        to: call.to,
        value: call.value,
        data: call.data,
    }));
    const routerCalls = [...tradeCalls, ...msgFeeCalls].map((call) => ({
        target: call.to,
        value: call.value ?? "0",
        callData: prefixHex(call.data ?? "0x"),
    }));

    const approvalCall = await buildOftApprovalCall(
        route,
        routerAddress,
        BigInt(tradeQuote.quote),
        transactionSigner,
    );
    if (approvalCall !== undefined) {
        routerCalls.push({
            target: approvalCall.to,
            value: approvalCall.value ?? "0",
            callData: prefixHex(approvalCall.data ?? "0x"),
        });
    }

    const { sendParam } = await quoteOftSend(
        quotedOft,
        route,
        resolvedDestination,
        tradeAmountOutMin,
    );
    const minAmountLd = calculateAmountOutMin(sendParam[3], slippage);
    const tokenAddress = requireTokenConfig(route.sourceAsset).address;
    const executeOftData = router.interface.encodeFunctionData("executeOft", [
        routerCalls,
        tokenAddress,
        oftContract.address,
        {
            dstEid: sendParam[0],
            to: sendParam[1],
            extraOptions: sendParam[4],
            composeMsg: sendParam[5],
            oftCmd: sendParam[6],
        },
        minAmountLd,
        msgFee[1],
        refundData.refundAddress,
    ]);

    return [
        {
            to: refundData.tokenAddress,
            data: erc20TransferInterface.encodeFunctionData("transfer", [
                routerAddress,
                refundData.amount,
            ]),
        },
        {
            to: routerAddress,
            data: executeOftData,
        },
    ];
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
    oft,
    cooperative,
}: {
    gasAbstraction: GasAbstractionType;
    transactionSigner: Signer | Wallet;
    contract: ERC20Swap;
    refundData: LockupEvent;
    signature?: Signature;
    slippage: number;
    dexDetails?: DexDetail;
    destination?: string;
    oft?: OftDetail;
    cooperative: boolean;
}): Promise<TransactionRequest | AlchemyCall[]> => {
    if (cooperative && signature === undefined) {
        throw new Error("missing cooperative refund signature");
    }

    const refundTransaction: TransactionRequest = {
        to: await contract.getAddress(),
        data: cooperative
            ? contract.interface.encodeFunctionData(
                  "refundCooperative(bytes32,uint256,address,address,address,uint256,uint8,bytes32,bytes32)",
                  [
                      refundData.preimageHash,
                      refundData.amount,
                      refundData.tokenAddress,
                      refundData.claimAddress,
                      refundData.refundAddress,
                      refundData.timelock,
                      signature?.v,
                      signature?.r,
                      signature?.s,
                  ],
              )
            : contract.interface.encodeFunctionData(
                  "refund(bytes32,uint256,address,address,address,uint256)",
                  [
                      refundData.preimageHash,
                      refundData.amount,
                      refundData.tokenAddress,
                      refundData.claimAddress,
                      refundData.refundAddress,
                      refundData.timelock,
                  ],
              ),
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
        oft,
    );

    if (followUpCalls !== undefined) {
        return [toAlchemyCall(refundTransaction), ...followUpCalls];
    }

    if (getAddress(destination) === getAddress(refundData.refundAddress)) {
        return [toAlchemyCall(refundTransaction)];
    }

    if (destination && refundData.tokenAddress) {
        return [
            toAlchemyCall(refundTransaction),
            {
                to: refundData.tokenAddress,
                data: erc20TransferInterface.encodeFunctionData("transfer", [
                    destination,
                    refundData.amount,
                ]),
            },
        ];
    }

    return refundTransaction;
};

export const RefundEvm = (props: {
    asset: string;
    gasAbstraction?: GasAbstractionType;
    transactionSigner?: Signer | Wallet;
    disabled?: boolean;
    swapId?: string;
    signerAddress: string;
    derivationPath?: string;
    swapType?: SwapType;
    lockupTxHash?: string;
    commitmentLockupTxHash?: string;
    setRefundTxId: Setter<string>;
    dexDetails?: DexDetail;
    destination?: string;
    oft?: OftDetail;
}) => {
    const { getErc20Swap, getEtherSwap, signer, getGasAbstractionSigner } =
        useWeb3Signer();
    const { t, slippage } = useGlobalContext();

    const gasAbstraction = createMemo(
        () => props.gasAbstraction ?? GasAbstractionType.None,
    );
    const transactionSigner = createMemo<Signer | Wallet | undefined>(() => {
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
        if (transactionSigner() === undefined) {
            setSignerNetwork(undefined);
            return;
        }
        void transactionSigner()
            .provider?.getNetwork()
            .then((network) => setSignerNetwork(Number(network?.chainId)))
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
              transactionSigner: Signer | Wallet;
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
            const contract = (
                contractKind === AssetKind.ERC20
                    ? getErc20Swap(asset)
                    : getEtherSwap(asset)
            ).connect(createAssetProvider(asset));

            log.debug("Fetching lockup data");
            const receipt = await assertTransactionSignerProvider(
                transactionSigner,
            ).getTransactionReceipt(lockupTx ?? commitmentLockupTxHash);
            if (receipt === null) {
                throw new Error("could not fetch lockup transaction receipt");
            }

            const data = getLockupEvent(
                contract,
                receipt,
                await contract.getAddress(),
            );

            let swapHash: string;
            if (contractKind === AssetKind.ERC20) {
                swapHash = await (contract as ERC20Swap).hashValues(
                    data.preimageHash,
                    data.amount,
                    data.tokenAddress,
                    data.claimAddress,
                    data.refundAddress,
                    data.timelock,
                );
            } else {
                swapHash = await (contract as EtherSwap).hashValues(
                    data.preimageHash,
                    data.amount,
                    data.claimAddress,
                    data.refundAddress,
                    data.timelock,
                );
            }

            const stillLocked = await contract.swaps(swapHash);
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
                            transactionSigner()?.address ?? props.signerAddress,
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
                            if (props.swapId === undefined) {
                                throw new Error(
                                    "swap id is required for cooperative refunds",
                                );
                            }

                            const { signature } = await getEipRefundSignature(
                                props.swapId,
                                props.swapType ?? SwapType.Submarine,
                            );
                            const decSignature = Signature.from(signature);

                            if (currentContractKind === AssetKind.ERC20) {
                                const contract = getErc20Swap(
                                    props.asset,
                                ).connect(currentTransactionSigner);
                                return await buildErc20RefundTransaction({
                                    gasAbstraction: gasAbstraction(),
                                    transactionSigner: currentTransactionSigner,
                                    contract,
                                    refundData: currentRefundData,
                                    signature: decSignature,
                                    slippage: slippage(),
                                    dexDetails: props.dexDetails,
                                    destination: props.destination,
                                    oft: props.oft,
                                    cooperative: true,
                                });
                            }

                            const contract = getEtherSwap(props.asset).connect(
                                currentTransactionSigner,
                            );
                            return await contract[
                                "refundCooperative(bytes32,uint256,address,address,uint256,uint8,bytes32,bytes32)"
                            ].populateTransaction(
                                currentRefundData.preimageHash,
                                currentRefundData.amount,
                                currentRefundData.claimAddress,
                                currentRefundData.refundAddress,
                                currentRefundData.timelock,
                                decSignature.v,
                                decSignature.r,
                                decSignature.s,
                            );
                        };

                        const refundTimeout = async () => {
                            if (currentContractKind === AssetKind.ERC20) {
                                const contract = getErc20Swap(
                                    props.asset,
                                ).connect(currentTransactionSigner);
                                return await buildErc20RefundTransaction({
                                    gasAbstraction: gasAbstraction(),
                                    transactionSigner: currentTransactionSigner,
                                    contract,
                                    refundData: currentRefundData,
                                    slippage: slippage(),
                                    dexDetails: props.dexDetails,
                                    destination: props.destination,
                                    oft: props.oft,
                                    cooperative: false,
                                });
                            }

                            const contract = getEtherSwap(props.asset).connect(
                                currentTransactionSigner,
                            );
                            return await contract[
                                "refund(bytes32,uint256,address,address,uint256)"
                            ].populateTransaction(
                                currentRefundData.preimageHash,
                                currentRefundData.amount,
                                currentRefundData.claimAddress,
                                currentRefundData.refundAddress,
                                currentRefundData.timelock,
                            );
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

    const [timeoutEta, setTimeoutEta] = createSignal<number | null>(null);
    const [timeoutBlockheight, setTimeoutBlockheight] = createSignal<
        number | null
    >(null);

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

        setValid(validateAddress(asset, refundAddress()));
    };

    const refundAction = async () => {
        setRefundRunning(true);

        try {
            const refundTxId = await refund(
                props.deriveKeyFn || deriveKey,
                props.swap(),
                refundAddress(),
                refundableUTXOs(),
                failureReason() === incorrectAssetError
                    ? RefundType.AssetRescue
                    : RefundType.Cooperative,
            );

            props.setRefundTxId(refundTxId);

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
                        setTimeoutEta(legacyTx.timeoutEta);
                        setTimeoutBlockheight(legacyTx.timeoutBlockHeight);
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
                    value={refundAddress()}
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
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId?: Setter<string>;
    buttonOverride?: string;
    deriveKeyFn?: deriveKeyFn;
}) => {
    const { setSwapStorage, getSwap } = useGlobalContext();
    const { setSwap } = usePayContext();

    const [refundTxId, setRefundTxId] = createSignal<string>("");

    createEffect(() => {
        const txId = refundTxId();
        if (txId === "") {
            return;
        }

        props.setRefundTxId?.(txId);
        setSwap({ ...props.swap(), refundTx: txId });
        void getSwap(props.swap().id).then((swapFromStorage) => {
            if (swapFromStorage) {
                swapFromStorage.refundTx = txId;
                void setSwapStorage(swapFromStorage);
            }
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
                    setRefundTxId={setRefundTxId}
                    asset={props.swap().assetSend}
                    commitmentLockupTxHash={props.swap().commitmentLockupTxHash}
                    lockupTxHash={props.swap().lockupTx}
                    dexDetails={props.swap().dex}
                    destination={props.swap().signer}
                    oft={props.swap().oft}
                />
            }>
            <RefundBtc {...props} setRefundTxId={setRefundTxId} />
        </Show>
    );
};

export default RefundButton;
