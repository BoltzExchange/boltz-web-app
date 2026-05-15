import BigNumber from "bignumber.js";
import {
    bridgeRegistry,
    toRouterCalls,
    vFromSignature,
} from "boltz-swaps/bridge";
import {
    type QuoteData,
    encodeDexQuote,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "boltz-swaps/client";
import {
    assetAmountToSats,
    prefix0x,
    satsToAssetAmount,
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
import { routerAbi } from "boltz-swaps/generated/evm-abis";
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
import {
    type Hex,
    encodeFunctionData,
    getAddress,
    parseSignature,
    zeroAddress,
} from "viem";

import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { config } from "../config";
import { getKindForAsset, getTokenAddress, isEvmAsset } from "../consts/Assets";
import { swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { type Signer, useWeb3Signer } from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import type { EncodedHop } from "../utils/Pair";
import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "../utils/calculate";
import { formatAmount, getDecimals } from "../utils/denomination";
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
    assetReceive: string,
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

    const claimAmount = satsToAssetAmount(amount, assetReceive);
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

    return calldata.flatMap(({ calls }) =>
        calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        })),
    );
};

export const signErc20ClaimToRouter = async (
    signer: Signer,
    erc20Swap: Erc20SwapContract,
    chainId: bigint,
    preimage: string,
    amount: bigint,
    tokenAddress: string,
    refundAddress: string,
    timeoutBlockHeight: number,
    routerAddress: string,
) => {
    const version = await erc20Swap.read.version();

    return parseSignature(
        await signer.signTypedData({
            account: signer.account,
            domain: {
                name: "ERC20Swap",
                version: String(version),
                verifyingContract: erc20Swap.address,
                chainId,
            },
            types: {
                Claim: [
                    { name: "preimage", type: "bytes32" },
                    { name: "amount", type: "uint256" },
                    { name: "tokenAddress", type: "address" },
                    { name: "refundAddress", type: "address" },
                    { name: "timelock", type: "uint256" },
                    { name: "destination", type: "address" },
                ],
            } as const,
            primaryType: "Claim",
            message: {
                preimage: prefix0x(preimage),
                amount,
                tokenAddress: getAddress(tokenAddress),
                refundAddress: getAddress(refundAddress),
                timelock: BigInt(timeoutBlockHeight),
                destination: getAddress(routerAddress),
            },
        }),
    );
};

const signRouterClaim = async (
    signer: Signer,
    routerAddress: string,
    chainId: bigint,
    preimage: string,
    finalToken: string,
    minAmountOut: bigint,
    destination: string,
) =>
    parseSignature(
        await signer.signTypedData({
            account: signer.account,
            domain: {
                name: "Router",
                version: "2",
                verifyingContract: getAddress(routerAddress),
                chainId,
            },
            types: {
                Claim: [
                    { name: "preimage", type: "bytes32" },
                    { name: "token", type: "address" },
                    { name: "minAmountOut", type: "uint256" },
                    { name: "destination", type: "address" },
                ],
            } as const,
            primaryType: "Claim",
            message: {
                preimage: prefix0x(preimage),
                token: getAddress(finalToken),
                minAmountOut,
                destination: getAddress(destination),
            },
        }),
    );

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

    const tx = {
        to: router.address,
        data: encodeFunctionData({
            abi: routerAbi,
            functionName: "claimERC20Execute",
            args: [
                {
                    preimage: prefix0x(preimage),
                    amount: assetAmount,
                    tokenAddress: getAddress(tokenAddress),
                    refundAddress: getAddress(refundAddress),
                    timelock: BigInt(timeoutBlockHeight),
                    v: vFromSignature(claimSignature),
                    r: claimSignature.r,
                    s: claimSignature.s,
                },
                toRouterCalls(calls),
                getAddress(execution.finalToken),
                execution.minAmountOut,
                getAddress(destination),
                vFromSignature(routerSignature),
                routerSignature.r,
                routerSignature.s,
            ],
        }),
    };

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
    const routerCalls = calldata.flatMap(({ calls }) =>
        calls.map((call) => ({
            target: call.to,
            value: call.value,
            callData: prefix0x(call.data),
        })),
    );

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

const AutoClaimHops = (props: {
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
    const { t, slippage, notify, getSwap, setSwapStorage } = useGlobalContext();
    const { swap, setSwap } = usePayContext();

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
                getGasAbstractionSigner(props.assetReceive),
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
                        props.assetReceive,
                        props.preimage,
                        props.amount,
                        props.refundAddress!,
                        props.timeoutBlockHeight,
                        props.signerAddress!,
                        () => claimSigner,
                        getErc20Swap(props.assetReceive),
                        slippage(),
                        quote.quote,
                        props.getGasToken === true,
                        props.bridge,
                    ),
                maxRetries,
                baseDelayMs,
                (e) => !isWalletRejectionError(e),
            );

            currentSwap.claimTx = transactionHash;
            currentSwap.dex.quoteAmount = normalizePersistedReceiveAmount(
                quote.amount,
                getFinalAssetReceive(currentSwap),
            );

            setSwap(currentSwap);
            await setSwapStorage(currentSwap);
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
                        props.assetReceive,
                    );
                    const useDexGasToken =
                        props.bridge === undefined &&
                        props.getGasToken === true &&
                        gasTopUpSupported(props.assetReceive);
                    const quote = await fetchDexQuote(
                        hop.dexDetails,
                        amountIn,
                        useDexGasToken,
                        useDexGasToken
                            ? await getGasTopUpNativeAmount(props.assetReceive)
                            : undefined,
                    );
                    if (props.signerAddress === undefined) {
                        return;
                    }
                    const quoteAmount = await getAcceptedQuoteAmount(
                        props.amount,
                        props.assetReceive,
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
                        log.info(
                            `Claim quote ${quoteAmount.toString()} is below threshold ${quoteThreshold().toString()} (expected ${props.dex.quoteAmount.toString()}, slippage ${slippage()})`,
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
    const { t, slippage, getSwap, setSwapStorage } = useGlobalContext();
    const { setSwap } = usePayContext();

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

        const currentSwap = await getSwap(props.swapId);

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
            result = await claimAsset(
                props.gasAbstraction,
                props.assetReceive,
                props.preimage,
                props.amount,
                getAddress(props.claimAddress),
                getAddress(props.refundAddress),
                props.timeoutBlockHeight,
                getAddress(props.signerAddress),
                () => sig,
                getGasAbstractionSigner(props.assetReceive),
                getEtherSwap(props.assetReceive),
                getErc20Swap(props.assetReceive),
            );
        }

        const { transactionHash, receiveAmount } = result;

        if (currentSwap === null) {
            return;
        }
        currentSwap.claimTx = transactionHash;
        currentSwap.receiveAmount = Number(
            normalizePersistedReceiveAmount(
                receiveAmount,
                getFinalAssetReceive(currentSwap),
            ),
        );
        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
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
