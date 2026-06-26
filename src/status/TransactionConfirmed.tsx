import BigNumber from "bignumber.js";
import { bridgeRegistry } from "boltz-swaps/bridge";
import {
    type QuoteData,
    encodeDexQuote,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "boltz-swaps/client";
import {
    assetAmountToSats,
    dexCalldataToRouterCalls,
    encodeRouterClaimExecuteTx,
    satsToAssetAmount,
    signErc20ClaimToRouter,
    signRouterClaim,
} from "boltz-swaps/evm";
import {
    type Erc20SwapContract,
    createRouterContract,
} from "boltz-swaps/evm/contracts";
import {
    type ClaimResult,
    type PopulatedEvmTransaction,
    getSignerForGasAbstraction,
} from "boltz-swaps/evm/transaction";
import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "boltz-swaps/helper";
import {
    AssetKind,
    NetworkTransport,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";
import log from "loglevel";
import { ImArrowDown } from "solid-icons/im";
import {
    type Accessor,
    Show,
    createEffect,
    createSignal,
    on,
    untrack,
} from "solid-js";
import { type Hex, getAddress, zeroAddress } from "viem";

import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { getKindForAsset, getTokenAddress, isEvmAsset } from "../consts/Assets";
import { swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { type Signer, useWeb3Signer } from "../context/Web3";
import { useModifySwap } from "../hooks/useModifySwap";
import type { DictKey } from "../i18n/i18n";
import type { EncodedHop } from "../utils/Pair";
import {
    formatAmount,
    formatAssetAmountForLog,
    getDecimals,
} from "../utils/denomination";
import { formatError, isWalletRejectionError } from "../utils/errors";
import { claimAsset, sendPopulatedTransaction } from "../utils/evmTransaction";
import { retryWithBackoff } from "../utils/promise";
import {
    type ClaimQuote,
    type DexQuote,
    fetchDexQuote,
    fetchGasTokenQuote,
    gasTopUpSupported,
    getGasTopUpNativeAmount,
} from "../utils/quoter";
import {
    type BridgeDetail,
    type ChainSwap,
    type DexDetail,
    GasAbstractionType,
    type ReverseSwap,
    getClaimGasAbstraction,
    getFinalAssetReceive,
    getPostBridgeDetail,
} from "../utils/swapCreator";

type RouterExecutionQuote = {
    chain: string;
    recipient: string;
    quote: DexQuote;
};

type RouterClaimExecution = {
    finalToken: string;
    minAmountOut: bigint;
    quotes: RouterExecutionQuote[];
};

export const normalizePersistedReceiveAmount = (
    amount: bigint,
    asset: string,
): string => {
    if (isEvmAsset(asset) && !getDecimals(asset).isErc20) {
        return assetAmountToSats(amount, asset).toString();
    }

    return amount.toString();
};

export const getClaimAssetForRoute = (
    assetReceive: string,
    dex?: DexDetail,
): string => {
    if (dex?.position !== SwapPosition.Post) {
        return assetReceive;
    }

    return dex.hops[0]?.from ?? assetReceive;
};

const withAutoClaimLock = async <T,>(
    swapId: string,
    fn: () => Promise<T>,
): Promise<T | undefined> => {
    if (navigator.locks?.request === undefined) {
        return await fn();
    }

    return await navigator.locks.request(
        `transactionConfirmedAutoClaim:${swapId}`,
        { ifAvailable: true },
        async (lock) => {
            if (lock === null) {
                log.info(
                    `Skipping duplicate auto-claim execution for swap ${swapId}`,
                );
                return undefined;
            }

            return await fn();
        },
    );
};

const parsePersistedQuoteAmount = (quoteAmount: number | string): bigint => {
    if (typeof quoteAmount === "string") {
        return BigInt(quoteAmount);
    }

    return BigInt(Math.round(quoteAmount));
};

const getPostBridgeQuoteOptions = async (
    bridge: BridgeDetail,
    destination: string,
    getGasToken: boolean,
) =>
    await bridgeRegistry
        .requireDriverForRoute(bridge)
        .buildQuoteOptions(bridge.destinationAsset, destination, getGasToken);

const getAcceptedQuoteAmount = async (
    amount: number,
    claimAsset: string,
    hop: EncodedHop,
    quote: ClaimQuote,
    destination: string,
    getGasToken: boolean,
    bridge?: BridgeDetail,
): Promise<bigint> => {
    if (bridge === undefined) {
        return quote.trade.amountOut;
    }

    const dexDetails = hop.dexDetails;
    if (dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    const claimAmount = satsToAssetAmount(amount, claimAsset);
    const bridgeDriver = bridgeRegistry.requireDriverForRoute(bridge);
    const bridgeQuoteOptions = await getPostBridgeQuoteOptions(
        bridge,
        destination,
        getGasToken,
    );
    const initialBridgeQuote = await bridgeDriver.quoteReceiveAmount(
        bridge,
        quote.trade.amountOut,
        bridgeQuoteOptions,
    );
    const bridgeMessagingFee = initialBridgeQuote.messagingFee?.amount ?? 0n;
    let adjustedClaimAmount = claimAmount;

    if (bridgeMessagingFee > 0n) {
        const [messagingFeeQuote] = await quoteDexAmountOut(
            dexDetails.chain,
            dexDetails.tokenIn,
            zeroAddress,
            bridgeMessagingFee,
        );
        adjustedClaimAmount -= BigInt(messagingFeeQuote.quote);
    }

    if (adjustedClaimAmount <= 0n) {
        throw new Error("adjusted claim amount must be greater than zero");
    }

    const adjustedTradeQuote = await fetchDexQuote(
        dexDetails,
        adjustedClaimAmount,
    );
    const adjustedBridgeQuote = await bridgeDriver.quoteReceiveAmount(
        bridge,
        adjustedTradeQuote.trade.amountOut,
        bridgeQuoteOptions,
    );

    return adjustedBridgeQuote.amountOut;
};

const getAssetChain = (asset: string): string => {
    const chain = config.assets?.[asset]?.network?.symbol;
    if (chain === undefined) {
        throw new Error(`missing network symbol for asset: ${asset}`);
    }

    return chain;
};

const getSingleClaimHop = (
    hops: EncodedHop[],
): EncodedHop & { dexDetails: NonNullable<EncodedHop["dexDetails"]> } => {
    if (hops.length !== 1) {
        throw new Error("only one hop is supported for now");
    }

    const [hop] = hops;
    if (hop.dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    return hop as EncodedHop & {
        dexDetails: NonNullable<EncodedHop["dexDetails"]>;
    };
};

const encodeRouterExecutionCalls = async (
    quotes: RouterExecutionQuote[],
    slippage: number,
) => {
    const calldata = await Promise.all(
        quotes.map(({ chain, recipient, quote }) =>
            encodeDexQuote(
                chain,
                recipient,
                quote.amountIn,
                calculateAmountOutMin(quote.amountOut, slippage),
                quote.data,
            ),
        ),
    );

    return dexCalldataToRouterCalls(calldata);
};

const claimErc20ViaRouter = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Signer,
    erc20Swap: Erc20SwapContract,
    slippage: number,
    execution: RouterClaimExecution,
) => {
    if (getKindForAsset(asset) === AssetKind.EVMNative) {
        throw new Error("EtherSwap is not supported for now");
    }

    const router = createRouterContract(asset, signer);
    const assetAmount = satsToAssetAmount(amount, asset);
    const tokenAddress = getTokenAddress(asset);
    const [chainId, calls] = await Promise.all([
        signer.provider.getChainId().then(BigInt),
        encodeRouterExecutionCalls(execution.quotes, slippage),
    ]);
    const [claimSignature, routerSignature] = await Promise.all([
        signErc20ClaimToRouter(
            signer,
            erc20Swap,
            chainId,
            preimage,
            assetAmount,
            tokenAddress,
            refundAddress,
            timeoutBlockHeight,
            router.address,
        ),
        signRouterClaim(
            signer,
            router.address,
            chainId,
            preimage,
            execution.finalToken,
            execution.minAmountOut,
            destination,
        ),
    ]);

    const tx = encodeRouterClaimExecuteTx({
        router,
        preimage,
        amount: assetAmount,
        tokenAddress,
        refundAddress,
        timeoutBlockHeight,
        claimSignature,
        routerCalls: calls,
        finalToken: execution.finalToken,
        minAmountOut: execution.minAmountOut,
        destination,
        routerSignature,
    });

    return await sendPopulatedTransaction(gasAbstraction, signer, tx);
};

const claimErc20ViaRouterBridge = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Signer,
    erc20Swap: Erc20SwapContract,
    slippage: number,
    hop: EncodedHop,
    quote: ClaimQuote,
    bridge: BridgeDetail,
    getGasToken: boolean,
) => {
    if (getKindForAsset(asset) === AssetKind.EVMNative) {
        throw new Error("EtherSwap is not supported for now");
    }

    const dexDetails = hop.dexDetails;
    if (dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    const bridgeDriver = bridgeRegistry.requireDriverForRoute(bridge);
    const sourceTransport = bridgeDriver.getTransport(bridge.sourceAsset);
    if (sourceTransport !== NetworkTransport.Evm) {
        throw new Error(
            `bridge router claim requires an EVM source contract, got ${String(sourceTransport)}`,
        );
    }
    const bridgeContract = await bridgeDriver.getContract(bridge);
    const router = createRouterContract(asset, signer);
    const assetAmount = satsToAssetAmount(amount, asset);
    const chainId = BigInt(await signer.provider.getChainId());

    const bridgeQuoteInstance = await bridgeDriver.getQuotedContract(bridge);
    const bridgeQuoteOptions = await getPostBridgeQuoteOptions(
        bridge,
        destination,
        getGasToken,
    );
    const { msgFee } = await bridgeDriver.quoteSend(
        bridgeQuoteInstance,
        bridge,
        destination,
        quote.trade.amountOut,
        bridgeQuoteOptions,
    );
    // Bridges that charge a native-gas messaging fee (OFT) need a prepay leg
    // that swaps part of the claim output into native; bridges without one
    // (CCTP: msgFee = [0, 0]) skip this entirely.
    let msgFeeEthQuote: QuoteData | undefined;
    let tradeAmountIn = assetAmount;
    if (msgFee[0] > 0n) {
        const msgFeeEthAmountOut = calculateAmountWithSlippage(
            msgFee[0],
            slippage,
        );
        [msgFeeEthQuote] = await quoteDexAmountOut(
            dexDetails.chain,
            dexDetails.tokenIn,
            zeroAddress,
            msgFeeEthAmountOut,
        );
        tradeAmountIn = assetAmount - BigInt(msgFeeEthQuote.quote);
        if (tradeAmountIn <= 0n) {
            throw new Error("amount too small to cover bridge messaging fee");
        }
    }

    const [tradeQuote] = await quoteDexAmountIn(
        dexDetails.chain,
        dexDetails.tokenIn,
        dexDetails.tokenOut,
        tradeAmountIn,
    );

    const amountOut = BigInt(tradeQuote.quote);
    const amountOutMin = calculateAmountOutMin(amountOut, slippage);
    const { sendParam, minAmount } = await bridgeDriver.quoteSend(
        bridgeQuoteInstance,
        bridge,
        destination,
        amountOutMin,
        bridgeQuoteOptions,
    );
    const amountLdWithSlippage = calculateAmountOutMin(minAmount, slippage);

    const calldata = await Promise.all([
        encodeDexQuote(
            dexDetails.chain,
            router.address,
            tradeAmountIn,
            amountOutMin,
            tradeQuote.data,
        ),
        ...(msgFeeEthQuote !== undefined
            ? [
                  encodeDexQuote(
                      dexDetails.chain,
                      router.address,
                      BigInt(msgFeeEthQuote.quote),
                      msgFee[0],
                      msgFeeEthQuote.data,
                  ),
              ]
            : []),
    ]);

    const tokenAddress = getTokenAddress(asset);
    const claimSignature = await signErc20ClaimToRouter(
        signer,
        erc20Swap,
        chainId,
        preimage,
        assetAmount,
        tokenAddress,
        refundAddress,
        timeoutBlockHeight,
        router.address,
    );
    const routerCalls = dexCalldataToRouterCalls(calldata);

    const approvalCall = await bridgeDriver.buildApprovalCall(
        bridge,
        router.address,
        amountOut,
        signer,
    );
    if (approvalCall !== undefined && approvalCall.data !== undefined) {
        routerCalls.push({
            target: approvalCall.to,
            value: "0",
            callData: (approvalCall.data ?? "0x") as Hex,
        });
    }

    const tx = await bridgeDriver.populateRouterClaimBridgeTransaction({
        router,
        signer,
        chainId,
        preimage,
        claimAmount: assetAmount,
        claimTokenAddress: tokenAddress,
        refundAddress,
        timeoutBlockHeight,
        claimSignature,
        route: bridge,
        bridgeContract,
        outputTokenAddress: dexDetails.tokenOut,
        routerCalls,
        sendParam,
        minAmountLd: amountLdWithSlippage,
        lzTokenFee: msgFee[1],
    });

    return await sendPopulatedTransaction(
        gasAbstraction,
        signer,
        tx as PopulatedEvmTransaction,
    );
};

const getHopRouterClaimExecution = (
    hop: EncodedHop,
    routerAddress: string,
    destination: string,
    slippage: number,
    quote: ClaimQuote,
): RouterClaimExecution => {
    const dexDetails = hop.dexDetails;
    if (dexDetails === undefined) {
        throw new Error("claim hop is missing DEX details");
    }

    return {
        finalToken: dexDetails.tokenOut,
        minAmountOut: calculateAmountOutMin(quote.trade.amountOut, slippage),
        quotes: [
            {
                chain: dexDetails.chain,
                recipient: routerAddress,
                quote: quote.trade,
            },
            ...(quote.gasToken === undefined
                ? []
                : [
                      {
                          chain: dexDetails.chain,
                          recipient: destination,
                          quote: quote.gasToken,
                      },
                  ]),
        ],
    };
};

const getGasTokenRouterClaimExecution = async (
    asset: string,
    amount: number,
    destination: string,
): Promise<RouterClaimExecution> => {
    const assetAmount = satsToAssetAmount(amount, asset);
    const chain = getAssetChain(asset);
    const finalToken = getTokenAddress(asset);
    const gasTokenAmount = await getGasTopUpNativeAmount(asset);
    const gasToken = await fetchGasTokenQuote(
        {
            chain,
            tokenIn: finalToken,
            tokenOut: finalToken,
        },
        gasTokenAmount,
    );

    if (gasToken.amountIn > assetAmount) {
        throw new Error("gas token quote exceeds claim amount");
    }

    return {
        finalToken,
        minAmountOut: assetAmount - gasToken.amountIn,
        quotes: [
            {
                chain,
                recipient: destination,
                quote: gasToken,
            },
        ],
    };
};

const claimHops = async (
    hops: EncodedHop[],
    gasAbstraction: GasAbstractionType,
    asset: string,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
    destination: string,
    signer: Accessor<Signer>,
    erc20Swap: Erc20SwapContract,
    slippage: number,
    quote: ClaimQuote,
    getGasToken: boolean,
    bridge?: BridgeDetail,
) => {
    if (bridge !== undefined) {
        return await claimErc20ViaRouterBridge(
            gasAbstraction,
            asset,
            preimage,
            amount,
            refundAddress,
            timeoutBlockHeight,
            destination,
            signer(),
            erc20Swap,
            slippage,
            getSingleClaimHop(hops),
            quote,
            bridge,
            getGasToken,
        );
    }

    const hop = getSingleClaimHop(hops);
    const routerAddress = createRouterContract(asset, signer()).address;
    const execution = getHopRouterClaimExecution(
        hop,
        routerAddress,
        destination,
        slippage,
        quote,
    );

    return await claimErc20ViaRouter(
        gasAbstraction,
        asset,
        preimage,
        amount,
        refundAddress,
        timeoutBlockHeight,
        destination,
        signer(),
        erc20Swap,
        slippage,
        execution,
    );
};

const Amount = (props: {
    label: DictKey;
    amount: number | string | bigint;
    asset: string;
}) => {
    const isErc20 = () => getDecimals(props.asset).isErc20;
    const { t, denomination, separator } = useGlobalContext();

    return (
        <div>
            <div>{t(props.label)}</div>
            <span>
                {formatAmount(
                    new BigNumber(props.amount.toString()),
                    denomination(),
                    separator(),
                    props.asset,
                ) || 0}
                <Show
                    when={!isErc20()}
                    fallback={
                        <span class="asset-fallback">{props.asset}</span>
                    }>
                    <span
                        class="denominator"
                        data-denominator={denomination()}
                    />
                </Show>
            </span>
        </div>
    );
};

export const AutoClaimHops = (props: {
    amount: number;
    swapId: string;
    gasAbstraction: GasAbstractionType;
    preimage: string;
    assetSend: string;
    assetReceive: string;
    signerAddress?: string;
    refundAddress?: string;
    timeoutBlockHeight: number;
    getGasToken?: boolean;
    dex: DexDetail;
    bridge?: BridgeDetail;
    autoClaimEnabled: boolean;
}) => {
    const { getErc20Swap, signer, getGasAbstractionSigner } = useWeb3Signer();
    const { t, slippage, notify, getSwap } = useGlobalContext();
    const { swap } = usePayContext();
    const modifySwap = useModifySwap();

    const [error, setError] = createSignal<string | undefined>(undefined);
    const [loading, setLoading] = createSignal(false);
    const [freshQuote, setFreshQuote] = createSignal<
        | {
              quote: ClaimQuote;
              amount: bigint;
          }
        | undefined
    >(undefined);
    const [quoteAccepted, setQuoteAccepted] = createSignal(false);

    const quoteThreshold = () =>
        calculateAmountOutMin(
            parsePersistedQuoteAmount(props.dex.quoteAmount),
            slippage(),
        );
    const claimAsset = () =>
        getClaimAssetForRoute(props.assetReceive, props.dex);
    const isOutsideSlippage = (quoteAmount: bigint) =>
        quoteAmount < quoteThreshold();

    const needsApproval = () => {
        const quote = freshQuote();
        if (quote === undefined) {
            return false;
        }

        return isOutsideSlippage(quote.amount);
    };

    const executeClaim = async (quote: {
        quote: ClaimQuote;
        amount: bigint;
    }) => {
        setLoading(true);
        try {
            const currentSwap = await getSwap(props.swapId);
            if (currentSwap === null) {
                log.warn(
                    `Skipping auto claim hops for missing swap ${props.swapId}`,
                );
                return;
            }
            if (currentSwap.dex === undefined) {
                log.warn(
                    `Skipping auto claim hops without DEX data for ${props.swapId}`,
                );
                return;
            }

            const claimSigner = getSignerForGasAbstraction(
                props.gasAbstraction,
                signer(),
                getGasAbstractionSigner(claimAsset()),
            );
            if (claimSigner === undefined) {
                log.warn(
                    `Skipping auto claim hops without signer for ${props.swapId}`,
                );
                return;
            }
            if (
                props.refundAddress === undefined ||
                props.signerAddress === undefined
            ) {
                log.warn(
                    `Skipping auto claim hops without addresses for ${props.swapId}`,
                );
                return;
            }

            const maxRetries = 3;
            const baseDelayMs = 2_000;
            const transactionHash = await retryWithBackoff(
                // eslint-disable-next-line solid/reactivity
                () =>
                    claimHops(
                        props.dex.hops,
                        props.gasAbstraction,
                        claimAsset(),
                        props.preimage,
                        props.amount,
                        props.refundAddress!,
                        props.timeoutBlockHeight,
                        props.signerAddress!,
                        () => claimSigner,
                        getErc20Swap(claimAsset()),
                        slippage(),
                        quote.quote,
                        props.getGasToken === true,
                        props.bridge,
                    ),
                maxRetries,
                baseDelayMs,
                (e) => !isWalletRejectionError(e),
            );

            await modifySwap<ChainSwap>(props.swapId, (s) => {
                s.claimTx = transactionHash;
                if (s.dex !== undefined) {
                    s.dex.quoteAmount = normalizePersistedReceiveAmount(
                        quote.amount,
                        getFinalAssetReceive(s),
                    );
                }
            });
        } catch (e) {
            log.error("Auto claim hops failed", e);
            const msg = `Transaction failed: ${formatError(e)}`;
            notify("error", msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    createEffect(
        on(
            () => props.autoClaimEnabled,
            async (autoClaimEnabled) => {
                if (!autoClaimEnabled) {
                    return;
                }

                try {
                    const hop = getSingleClaimHop(props.dex.hops);
                    const amountIn = satsToAssetAmount(
                        props.amount,
                        claimAsset(),
                    );
                    const useDexGasToken =
                        props.bridge === undefined &&
                        props.getGasToken === true &&
                        gasTopUpSupported(claimAsset());
                    const quote = await fetchDexQuote(
                        hop.dexDetails,
                        amountIn,
                        useDexGasToken,
                        useDexGasToken
                            ? await getGasTopUpNativeAmount(claimAsset())
                            : undefined,
                    );
                    if (props.signerAddress === undefined) {
                        return;
                    }
                    const quoteAmount = await getAcceptedQuoteAmount(
                        props.amount,
                        claimAsset(),
                        hop,
                        quote,
                        props.signerAddress,
                        props.getGasToken === true,
                        props.bridge,
                    );
                    const freshQuoteData = {
                        quote,
                        amount: quoteAmount,
                    };
                    setFreshQuote(freshQuoteData);

                    if (!isOutsideSlippage(quoteAmount)) {
                        // Within slippage tolerance, auto-claim
                        await withAutoClaimLock(props.swapId, async () => {
                            await untrack(() => executeClaim(freshQuoteData));
                        });
                    } else {
                        const finalReceiveAsset = getFinalAssetReceive(
                            swap()!,
                            true,
                        );
                        log.info(
                            `Claim quote ${formatAssetAmountForLog(
                                quoteAmount,
                                finalReceiveAsset,
                            )} is below threshold ${formatAssetAmountForLog(
                                quoteThreshold(),
                                finalReceiveAsset,
                            )} (expected ${formatAssetAmountForLog(
                                props.dex.quoteAmount,
                                finalReceiveAsset,
                            )}, slippage ${slippage()})`,
                        );
                    }
                } catch (e) {
                    log.error("Auto claim hops failed", e);
                    const msg = `Transaction failed: ${formatError(e)}`;
                    notify("error", msg);
                    setError(msg);
                }
            },
        ),
    );

    return (
        <Show
            when={!error()}
            fallback={
                <div class="error-container">
                    <p>{error()}</p>
                    <button
                        class="btn btn-primary"
                        disabled={loading()}
                        onClick={async () => {
                            const quote = freshQuote();
                            if (!quote) {
                                notify("error", t("error_no_quote"));
                                return;
                            }
                            setError(undefined);
                            await executeClaim(quote);
                        }}>
                        {t("retry")}
                    </button>
                </div>
            }>
            <Show
                when={
                    freshQuote() !== undefined &&
                    needsApproval() &&
                    !quoteAccepted()
                }
                fallback={
                    <Show
                        when={loading()}
                        fallback={
                            <>
                                <p>{t("tx_ready_to_claim")}</p>
                                <LoadingSpinner />
                            </>
                        }>
                        <LoadingSpinner />
                    </Show>
                }>
                <h2>{t("dex_quote_changed")}</h2>
                <div class="quote">
                    <Amount
                        label={"sent"}
                        amount={swap()!.sendAmount}
                        asset={props.assetSend}
                    />
                    <ImArrowDown size={15} style={{ opacity: 0.5 }} />
                    <Amount
                        label={"will_receive"}
                        amount={freshQuote()!.amount}
                        asset={getFinalAssetReceive(swap()!, true)}
                    />
                </div>

                <div class="btns btns-space-between">
                    <button
                        class="btn btn-success"
                        disabled={loading()}
                        onClick={async () => {
                            const q = freshQuote();
                            if (q === undefined) {
                                return;
                            }
                            setQuoteAccepted(true);
                            await executeClaim(q);
                        }}>
                        {loading() ? (
                            <LoadingSpinner class="inner-spinner" />
                        ) : (
                            t("accept")
                        )}
                    </button>
                </div>
            </Show>
        </Show>
    );
};

// TODO: use bignumber for amounts
const ClaimEvm = (props: {
    amount: number;
    swapId: string;
    gasAbstraction: GasAbstractionType;
    preimage: string;
    assetSend: string;
    assetReceive: string;
    signerAddress?: string;
    claimAddress: string;
    refundAddress?: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
    finalReceive: string;
    getGasToken?: boolean;
    dex?: DexDetail;
    bridge?: BridgeDetail;
    autoClaimEnabled: boolean;
}) => {
    const { getEtherSwap, getErc20Swap, getGasAbstractionSigner, signer } =
        useWeb3Signer();
    const { t, slippage } = useGlobalContext();
    const modifySwap = useModifySwap();

    const claimableWithoutInteraction = () =>
        props.gasAbstraction === GasAbstractionType.Signer;

    const claimWithoutHops = async () => {
        // Ignore swaps with dex hops here
        if (props.dex !== undefined && props.dex.hops.length > 0) {
            return;
        }
        if (props.signerAddress === undefined) {
            throw new Error("missing signer address for claim");
        }
        if (props.refundAddress === undefined) {
            throw new Error("missing refund address for claim");
        }

        let result: ClaimResult;

        if (
            getKindForAsset(props.assetReceive) !== AssetKind.EVMNative &&
            props.getGasToken &&
            gasTopUpSupported(props.assetReceive)
        ) {
            const claimSigner = getSignerForGasAbstraction(
                props.gasAbstraction,
                signer(),
                getGasAbstractionSigner(props.assetReceive),
            );
            if (claimSigner === undefined) {
                throw new Error("missing signer for gas-token claim");
            }
            const execution = await getGasTokenRouterClaimExecution(
                props.assetReceive,
                props.amount,
                props.signerAddress,
            );
            result = {
                transactionHash: await claimErc20ViaRouter(
                    props.gasAbstraction,
                    props.assetReceive,
                    props.preimage,
                    props.amount,
                    props.refundAddress,
                    props.timeoutBlockHeight,
                    props.signerAddress,
                    claimSigner,
                    getErc20Swap(props.assetReceive),
                    slippage(),
                    execution,
                ),
                receiveAmount: execution.minAmountOut,
            };
        } else {
            const sig = signer();
            if (sig === undefined) {
                throw new Error("missing signer for claim");
            }
            result = await claimAsset({
                gasAbstraction: props.gasAbstraction,
                asset: props.assetReceive,
                preimage: props.preimage,
                amount: props.amount,
                claimAddress: getAddress(props.claimAddress),
                refundAddress: getAddress(props.refundAddress),
                timeoutBlockHeight: props.timeoutBlockHeight,
                destination: getAddress(props.signerAddress),
                signer: () => sig,
                gasAbstractionSigner: getGasAbstractionSigner(
                    props.assetReceive,
                ),
                etherSwap: getEtherSwap(props.assetReceive),
                erc20Swap: getErc20Swap(props.assetReceive),
            });
        }

        const { transactionHash, receiveAmount } = result;

        await modifySwap(props.swapId, (s) => {
            s.claimTx = transactionHash;
            s.receiveAmount = Number(
                normalizePersistedReceiveAmount(
                    receiveAmount,
                    getFinalAssetReceive(s),
                ),
            );
        });
    };

    createEffect(
        on(
            () => props.autoClaimEnabled,
            async (autoClaimEnabled) => {
                if (autoClaimEnabled && claimableWithoutInteraction()) {
                    await withAutoClaimLock(props.swapId, async () => {
                        await untrack(() => claimWithoutHops());
                    });
                }
            },
        ),
    );

    return (
        <Show
            when={
                props.dex === undefined ||
                props.dex.hops === undefined ||
                props.dex.hops.length === 0
            }
            fallback={
                <AutoClaimHops
                    swapId={props.swapId}
                    gasAbstraction={props.gasAbstraction}
                    preimage={props.preimage}
                    signerAddress={props.signerAddress}
                    amount={props.amount}
                    refundAddress={props.refundAddress}
                    timeoutBlockHeight={props.timeoutBlockHeight}
                    assetSend={props.assetSend}
                    assetReceive={props.assetReceive}
                    getGasToken={props.getGasToken}
                    dex={props.dex!}
                    bridge={getPostBridgeDetail(props.bridge)}
                    autoClaimEnabled={props.autoClaimEnabled}
                />
            }>
            <Show
                when={!claimableWithoutInteraction()}
                fallback={<LoadingSpinner />}>
                <ContractTransaction
                    asset={props.assetReceive}
                    onClick={claimWithoutHops}
                    address={{
                        address: props.signerAddress!,
                        derivationPath: props.derivationPath,
                    }}
                    buttonText={t("continue")}
                    promptText={t("transaction_prompt_receive", {
                        button: t("continue"),
                        asset: props.finalReceive,
                    })}
                    waitingText={t("tx_ready_to_claim")}
                />
            </Show>
        </Show>
    );
};

const TransactionConfirmed = () => {
    const { t } = useGlobalContext();
    const { swap, swapStatus } = usePayContext();

    const chain = swap() as ChainSwap;
    const reverse = swap() as ReverseSwap;

    const dexToClaim = (dex?: DexDetail) => {
        if (dex?.position === SwapPosition.Post) {
            return dex;
        }

        return undefined;
    };

    return (
        <Show
            when={swap() !== null && isEvmAsset(swap()!.assetReceive)}
            fallback={
                <div>
                    <h2>{t("tx_confirmed")}</h2>
                    <p>{t("tx_ready_to_claim")}</p>
                    <LoadingSpinner />
                </div>
            }>
            <Show
                when={swap()!.type !== SwapType.Chain}
                fallback={
                    <ClaimEvm
                        swapId={chain.id}
                        gasAbstraction={getClaimGasAbstraction(chain)}
                        preimage={chain.preimage}
                        signerAddress={
                            chain.originalDestination || chain.signer
                        }
                        amount={chain.claimDetails.amount!}
                        derivationPath={chain.derivationPath}
                        claimAddress={chain.claimAddress}
                        refundAddress={chain.claimDetails.refundAddress}
                        timeoutBlockHeight={
                            chain.claimDetails.timeoutBlockHeight
                        }
                        assetSend={chain.assetSend}
                        assetReceive={chain.assetReceive}
                        dex={dexToClaim(chain.dex)}
                        finalReceive={getFinalAssetReceive(chain, true)}
                        getGasToken={chain.getGasToken}
                        bridge={chain.bridge}
                        autoClaimEnabled={
                            swapStatus() ===
                            swapStatusPending.TransactionServerConfirmed
                        }
                    />
                }>
                <ClaimEvm
                    swapId={reverse.id}
                    gasAbstraction={getClaimGasAbstraction(reverse)}
                    preimage={reverse.preimage}
                    amount={reverse.onchainAmount}
                    signerAddress={
                        reverse.originalDestination || reverse.signer
                    }
                    claimAddress={reverse.claimAddress}
                    refundAddress={reverse.refundAddress}
                    derivationPath={reverse.derivationPath}
                    timeoutBlockHeight={reverse.timeoutBlockHeight}
                    assetSend={reverse.assetSend}
                    assetReceive={reverse.assetReceive}
                    dex={dexToClaim(reverse.dex)}
                    bridge={reverse.bridge}
                    finalReceive={getFinalAssetReceive(reverse, true)}
                    getGasToken={reverse.getGasToken}
                    autoClaimEnabled={true}
                />
            </Show>
        </Show>
    );
};

export default TransactionConfirmed;
