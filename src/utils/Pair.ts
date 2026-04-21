import BigNumber from "bignumber.js";
import { ZeroAddress } from "ethers";
import log from "loglevel";

import { config } from "../config";
import { isTor } from "../configs/base";
import {
    AssetKind,
    BTC,
    LN,
    TBTC,
    getCanonicalAsset,
    getRouteViaAsset,
    isBridgeAsset,
    isEvmAsset,
} from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import {
    type ChainPairTypeTaproot,
    type Pairs,
    type ReversePairTypeTaproot,
    type SubmarinePairTypeTaproot,
    quoteDexAmountOut,
} from "./boltzClient";
import type { BridgeDriver } from "./bridge";
import { bridgeRegistry } from "./bridge/registry";
import type {
    BridgeErrorLike,
    BridgeNativeDropFailure,
    BridgeQuoteOptions,
    BridgeReceiveQuote,
    BridgeRoute,
} from "./bridge/types";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "./calculate";
import { coalesceLn } from "./helper";
import {
    fetchDexQuote,
    fetchGasTokenQuote,
    gasTopUpSupported,
    getGasTopUpNativeAmount,
} from "./quoter";
import { assetAmountToSats, satsToAssetAmount } from "./rootstock";

/**
 * Whether an asset is a routed ERC20 (like USDT0) whose internal
 * representation is already in native token base units.
 * Non-routed assets (like TBTC) use sats internally and need conversion.
 */
const isRoutedAsset = (asset: string) =>
    getRouteViaAsset(asset) !== undefined ||
    config.assets[asset]?.bridge !== undefined;

/** Convert an internal amount to EVM base units for the DEX API. */
const toDexAmount = (amount: number, asset: string): bigint =>
    isRoutedAsset(asset)
        ? BigInt(Math.round(amount))
        : satsToAssetAmount(amount, asset);

/** Convert an EVM base unit amount from the DEX API back to internal representation. */
const fromDexAmount = (amount: bigint, asset: string): BigNumber =>
    isRoutedAsset(asset)
        ? BigNumber(amount.toString())
        : BigNumber(assetAmountToSats(amount, asset).toString());

export const enum RequiredInput {
    Address,
    Invoice,
    Web3,
    Unknown,
}

export const enum BridgeMessagingFeeDisplayMode {
    Details = "details",
    Inline = "inline",
}

type Hop = {
    type: SwapType;
    from: string;
    to: string;
    pair?:
        | SubmarinePairTypeTaproot
        | ReversePairTypeTaproot
        | ChainPairTypeTaproot;
    dexDetails?: {
        chain: string;
        tokenIn: string;
        tokenOut: string;
    };
};

export type EncodedHop = Pick<Hop, "type" | "from" | "to" | "dexDetails">;

export type CreationData = {
    type: SwapType;
    sendAmount: BigNumber;
    receiveAmount: BigNumber;
    from: string;
    to: string;
    pairHash: string;
    hops: EncodedHop[];
    hopsPosition: SwapPosition | undefined;
};

const toEncodedHop = (hop: Hop): EncodedHop => {
    return {
        type: hop.type,
        from: hop.from,
        to: hop.to,
        dexDetails: hop.dexDetails,
    };
};

export default class Pair {
    private readonly route: Hop[] = [];
    private readonly preBridgeDriver: BridgeDriver | undefined;
    private readonly preBridge: BridgeRoute | undefined;
    private readonly postBridgeDriver: BridgeDriver | undefined;
    private readonly postBridge: BridgeRoute | undefined;
    private latestBoltzSwapSendAmount:
        | {
              sendAmount: string;
              value: BigNumber;
          }
        | undefined;
    private latestBridgeFee:
        | {
              sendAmount: string;
              messaging?:
                  | {
                        value: bigint;
                        token: string | undefined;
                    }
                  | undefined;
              transfer?: BigNumber | undefined;
          }
        | undefined;

    constructor(
        public readonly pairs: Pairs | undefined,
        private readonly from: string,
        private readonly to: string,
        private readonly regularPairs?: Pairs,
    ) {
        if (config.assets[from]?.canSend === false) {
            log.info(`Send asset ${from} is not allowed`);
            return;
        }

        if (
            config.assets[from]?.disabled === true ||
            config.assets[to]?.disabled === true
        ) {
            log.info(`Pair ${from} -> ${to} contains disabled asset`);
            return;
        }

        if (
            isTor() &&
            (from === TBTC ||
                to === TBTC ||
                isBridgeAsset(from) ||
                isBridgeAsset(to))
        ) {
            log.info("TBTC and bridged pairs are disabled on Tor");
            return;
        }

        const routeSource = getCanonicalAsset(from);
        const routeTarget = getCanonicalAsset(to);
        const canonicalSourceAsset = config.assets[routeSource];
        const canonicalTargetAsset = config.assets[routeTarget];
        this.preBridgeDriver = bridgeRegistry.getDriverForAsset(from);
        this.preBridge = this.preBridgeDriver?.getPreRoute(from);
        this.postBridgeDriver = bridgeRegistry.getDriverForAsset(to);
        this.postBridge = this.postBridgeDriver?.getPostRoute(to);

        const logDisabledAssetInRoute = (route: Hop[]): boolean => {
            const disabledAsset = Pair.findDisabledAssetInRoute(route);
            if (disabledAsset !== undefined) {
                log.info(
                    `Pair ${from} -> ${to} contains disabled asset ${disabledAsset}`,
                );
                return true;
            }
            return false;
        };

        const pair = Pair.findPair(pairs, routeSource, routeTarget);
        if (pair !== undefined) {
            log.debug(`Found direct pair for ${from} -> ${routeTarget}`);
            const proposedRoute: Hop[] = [
                {
                    type: pair.type,
                    pair: pair.pair,
                    from: routeSource,
                    to: routeTarget,
                },
            ];
            if (logDisabledAssetInRoute(proposedRoute)) {
                return;
            }
            this.route = proposedRoute;
            return;
        }

        if (
            canonicalTargetAsset !== undefined &&
            canonicalTargetAsset.type === AssetKind.ERC20
        ) {
            const hopAssetSymbol = getRouteViaAsset(to);
            const hopAsset = config.assets[hopAssetSymbol];
            const hopPair =
                hopAssetSymbol !== undefined
                    ? Pair.findPair(pairs, routeSource, hopAssetSymbol)
                    : undefined;

            if (hopPair !== undefined && hopAsset !== undefined) {
                log.debug(
                    `Found route for ${from} -> ${hopAssetSymbol} -> ${routeTarget}`,
                );
                const proposedRoute: Hop[] = [
                    {
                        type: hopPair.type,
                        pair: hopPair.pair,
                        from: routeSource,
                        to: hopAssetSymbol,
                    },
                    {
                        type: SwapType.Dex,
                        from: hopAssetSymbol,
                        to: routeTarget,
                        dexDetails: {
                            chain: hopAsset.network?.symbol,
                            tokenIn: hopAsset.token?.address,
                            tokenOut: canonicalTargetAsset.token?.address,
                        },
                    },
                ];
                if (logDisabledAssetInRoute(proposedRoute)) {
                    return;
                }
                this.route = proposedRoute;
                return;
            }
        }

        if (
            canonicalSourceAsset !== undefined &&
            canonicalSourceAsset.type === AssetKind.ERC20
        ) {
            const hopAssetSymbol = getRouteViaAsset(from);
            const hopAsset = config.assets[hopAssetSymbol];
            const hopPair =
                hopAssetSymbol !== undefined
                    ? Pair.findPair(pairs, hopAssetSymbol, routeTarget)
                    : undefined;

            if (hopPair !== undefined && hopAsset !== undefined) {
                log.debug(
                    `Found route for ${from} -> ${hopAssetSymbol} -> ${routeTarget}`,
                );
                const proposedRoute: Hop[] = [
                    {
                        type: SwapType.Dex,
                        from: routeSource,
                        to: hopAssetSymbol,
                        dexDetails: {
                            chain: canonicalSourceAsset.network?.symbol,
                            tokenIn: canonicalSourceAsset.token?.address,
                            tokenOut: hopAsset.token?.address,
                        },
                    },
                    {
                        type: hopPair.type,
                        pair: hopPair.pair,
                        from: hopAssetSymbol,
                        to: routeTarget,
                    },
                ];
                if (logDisabledAssetInRoute(proposedRoute)) {
                    return;
                }
                this.route = proposedRoute;
                return;
            }
        }

        log.info(`No pair found for ${from} -> ${to}`);
    }

    private static findDisabledAssetInRoute = (
        route: Hop[],
    ): string | undefined => {
        for (const hop of route) {
            for (const asset of [hop.from, hop.to]) {
                if (config.assets[asset]?.disabled === true) {
                    return asset;
                }
            }
        }
        return undefined;
    };

    private static findPair = (
        pairs: Pairs | undefined,
        from: string,
        to: string,
    ): Pick<Hop, "type" | "pair"> | undefined => {
        if (pairs === undefined) {
            return undefined;
        }

        // Wrap in a try/catch to prevent throws when reading properties of undefined
        try {
            if (to === LN) {
                const pair = pairs[SwapType.Submarine][from][BTC];
                if (pair === undefined) {
                    return undefined;
                }

                return {
                    type: SwapType.Submarine,
                    pair,
                };
            } else if (from === LN) {
                const pair = pairs[SwapType.Reverse][BTC][to];
                if (pair === undefined) {
                    return undefined;
                }

                return {
                    type: SwapType.Reverse,
                    pair,
                };
            } else {
                const pair = pairs[SwapType.Chain][from][to];
                if (pair === undefined) {
                    return undefined;
                }

                return {
                    type: SwapType.Chain,
                    pair,
                };
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            return undefined;
        }
    };

    public get isRoutable() {
        return this.route.length > 0;
    }

    public get needsNetworkForQuote() {
        return (
            this.preBridge !== undefined ||
            this.postBridge !== undefined ||
            this.route.some((hop) => hop.type === SwapType.Dex)
        );
    }

    public get requiredInput() {
        if (!this.isRoutable) {
            return RequiredInput.Unknown;
        }

        if (this.postBridge !== undefined) {
            return isEvmAsset(this.postBridge.destinationAsset)
                ? RequiredInput.Web3
                : RequiredInput.Address;
        }

        const lastHop = this.route[this.route.length - 1];

        if (lastHop.type === SwapType.Submarine) {
            return RequiredInput.Invoice;
        }

        if (isEvmAsset(lastHop.to) || lastHop.type === SwapType.Dex) {
            return RequiredInput.Web3;
        }

        return RequiredInput.Address;
    }

    public get hasPreBridge() {
        return this.preBridge !== undefined;
    }

    public get hasPostBridge() {
        return this.postBridge !== undefined;
    }

    public get needsBackup() {
        return this.route.some(
            (hop) =>
                !isEvmAsset(hop.from) &&
                (hop.type === SwapType.Submarine ||
                    hop.type === SwapType.Chain),
        );
    }

    public get fromAsset() {
        return this.from;
    }

    public get toAsset() {
        return this.to;
    }

    private getCanZeroAmountBlockers = (): string[] => {
        const blockers: string[] = [];

        if (this.preBridge !== undefined) {
            blockers.push("pre-bridge routing is enabled");
        }

        const firstHop = this.route[0];
        if (firstHop === undefined) {
            blockers.push("route has no first hop");
            return blockers;
        }

        if (firstHop.type !== SwapType.Chain) {
            blockers.push(`first hop type is ${firstHop.type}`);
        }

        if (isEvmAsset(firstHop.from)) {
            blockers.push(`send asset ${firstHop.from} is EVM`);
        }

        return blockers;
    };

    public get canZeroAmount() {
        const blockers = this.getCanZeroAmountBlockers();
        const canZeroAmount = blockers.length === 0;

        if (!canZeroAmount) {
            log.debug("0-amount swap disabled for pair", {
                from: this.from,
                to: this.to,
                blockers,
                route: this.route.map(({ from, to, type }) => ({
                    from,
                    to,
                    type,
                })),
                hasPreBridge: this.preBridge !== undefined,
                hasPostBridge: this.postBridge !== undefined,
            });
        }

        return canZeroAmount;
    }

    public get feePercentage() {
        return this.route
            .filter((hop) => hop.pair !== undefined)
            .reduce((acc, hop) => acc + hop.pair.fees.percentage, 0);
    }

    public get maxRoutingFee() {
        if (!this.isRoutable) {
            return undefined;
        }

        const maxFee = this.route
            .filter(
                (hop) =>
                    hop.pair !== undefined && hop.type === SwapType.Submarine,
            )
            .reduce((min, hop) => {
                const fee = (hop.pair as SubmarinePairTypeTaproot).fees
                    .maximalRoutingFee;
                return Math.max(min, fee || 0);
            }, 0);

        if (maxFee === 0) {
            return undefined;
        }

        return maxFee;
    }

    public get minerFees() {
        return this.route
            .filter((hop) => hop.pair !== undefined)
            .reduce((acc, hop) => {
                switch (hop.type) {
                    case SwapType.Submarine:
                        return (
                            acc +
                            (hop.pair as SubmarinePairTypeTaproot).fees
                                .minerFees
                        );
                    case SwapType.Reverse: {
                        const pair = (hop.pair as ReversePairTypeTaproot).fees
                            .minerFees;
                        return acc + pair.claim + pair.lockup;
                    }
                    case SwapType.Chain: {
                        const chainPair = (hop.pair as ChainPairTypeTaproot)
                            .fees.minerFees;
                        return acc + chainPair.server + chainPair.user.claim;
                    }
                    default:
                        return acc;
                }
            }, 0);
    }

    private get boltzHop() {
        return this.route.find((hop) => hop.pair !== undefined);
    }

    private get dexHopBeforeBoltz(): Hop | undefined {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) return undefined;

        const boltzIndex = this.route.indexOf(boltzHop);
        if (boltzIndex > 0) {
            const prevHop = this.route[boltzIndex - 1];
            if (prevHop.type === SwapType.Dex) {
                return prevHop;
            }
        }

        return undefined;
    }

    private get postBridgeDexHop(): Hop | undefined {
        if (this.postBridge === undefined || this.route.length === 0) {
            return undefined;
        }

        const lastHop = this.route[this.route.length - 1];
        return lastHop.type === SwapType.Dex ? lastHop : undefined;
    }

    private get routeWithoutPostBridgeDex(): Hop[] {
        return this.postBridgeDexHop !== undefined
            ? this.route.slice(0, -1)
            : this.route;
    }

    // Constructor invariant: `preBridge` is only assigned when
    // `preBridgeDriver` resolved, and vice versa for post. These helpers
    // encapsulate the `!` assertion in one place.
    private requirePreBridge = ():
        | { driver: BridgeDriver; route: BridgeRoute }
        | undefined => {
        if (this.preBridge === undefined) return undefined;
        return { driver: this.preBridgeDriver!, route: this.preBridge };
    };

    private requirePostBridge = ():
        | { driver: BridgeDriver; route: BridgeRoute }
        | undefined => {
        if (this.postBridge === undefined) return undefined;
        return { driver: this.postBridgeDriver!, route: this.postBridge };
    };

    private useDexGasToken = (getGasToken: boolean): boolean =>
        getGasToken &&
        this.postBridge === undefined &&
        gasTopUpSupported(this.to);

    private get preBridgeMessagingFeeToken() {
        return this.preBridge
            ? this.preBridgeDriver?.getMessagingFeeToken(this.preBridge)
            : undefined;
    }

    private get postBridgeMessagingFeeToken() {
        return this.postBridge
            ? this.postBridgeDriver?.getMessagingFeeToken(this.postBridge)
            : undefined;
    }

    private cacheLatestBridgeFee = (
        sendAmountKey: string,
        quote: BridgeReceiveQuote,
    ) => {
        this.latestBridgeFee = {
            sendAmount: sendAmountKey,
            messaging: {
                value: quote.msgFee[0],
                token: this.bridgeMessagingFeeToken,
            },
            transfer: BigNumber((quote.amountIn - quote.amountOut).toString()),
        };
    };

    private get postBridgeClaimAsset() {
        return this.postBridgeDexHop?.from ?? this.postBridge?.sourceAsset;
    }

    private get postBridgeFeeQuoteDetails():
        | {
              chain: string;
              tokenIn: string;
          }
        | undefined {
        const claimAsset = this.postBridgeClaimAsset;
        if (claimAsset === undefined) {
            return undefined;
        }

        const claimAssetConfig = config.assets?.[claimAsset];
        const chain =
            this.postBridgeDexHop?.dexDetails?.chain ??
            claimAssetConfig?.network?.symbol;
        const tokenIn =
            this.postBridgeDexHop?.dexDetails?.tokenIn ??
            claimAssetConfig?.token?.address;

        if (chain === undefined || tokenIn === undefined) {
            return undefined;
        }

        return {
            chain,
            tokenIn,
        };
    }

    private getPostBridgeQuoteOptions = async (
        postBridgeRecipient?: string,
        getGasToken: boolean = false,
    ): Promise<BridgeQuoteOptions | undefined> => {
        const post = this.requirePostBridge();
        if (
            post === undefined ||
            postBridgeRecipient === undefined ||
            postBridgeRecipient === ""
        ) {
            return undefined;
        }

        log.info("Built post-bridge quote options", {
            destinationAsset: this.to,
            postBridgeRecipient,
            getGasToken,
        });
        return await post.driver.buildQuoteOptions(
            this.to,
            postBridgeRecipient,
            getGasToken,
        );
    };

    private getNativeDropFailure = (
        driver: BridgeDriver | undefined,
        error: unknown,
    ): BridgeNativeDropFailure | undefined => {
        return driver?.getNativeDropFailure(error as BridgeErrorLike);
    };

    private getNativeDropLogDetails = (
        nativeDropFailure: BridgeNativeDropFailure | undefined,
    ) => {
        return nativeDropFailure?.reason === "exceeds_cap"
            ? {
                  amount: nativeDropFailure.amount?.toString(),
                  cap: nativeDropFailure.cap?.toString(),
              }
            : {};
    };

    public canPostBridgeNativeDrop = async (
        postBridgeRecipient?: string,
    ): Promise<boolean> => {
        const post = this.requirePostBridge();
        if (
            post === undefined ||
            postBridgeRecipient === undefined ||
            postBridgeRecipient === "" ||
            !gasTopUpSupported(this.to)
        ) {
            log.info("Post-bridge native drop capability check skipped", {
                destinationAsset: this.to,
                postBridgeRecipient,
                hasPostBridge: post !== undefined,
                gasTopUpSupported: gasTopUpSupported(this.to),
            });
            return false;
        }

        try {
            const postBridgeQuoteOptions = await this.getPostBridgeQuoteOptions(
                postBridgeRecipient,
                true,
            );

            if (postBridgeQuoteOptions?.nativeDrop === undefined) {
                log.info(
                    "Post-bridge native drop capability unavailable from bridge driver",
                    {
                        destinationAsset: this.to,
                        postBridgeRecipient,
                    },
                );
                return false;
            }

            log.info("Checking post-bridge native drop capability", {
                sourceAsset: post.route.sourceAsset,
                destinationAsset: this.to,
                postBridgeRecipient,
            });
            await post.driver.quoteReceiveAmount(
                post.route,
                1n,
                postBridgeQuoteOptions,
            );
            log.info("Post-bridge native drop capability confirmed", {
                destinationAsset: this.to,
                postBridgeRecipient,
            });
            return true;
        } catch (error) {
            const nativeDropFailure = this.getNativeDropFailure(
                post.driver,
                error,
            );
            if (nativeDropFailure !== undefined) {
                log.warn("Post-bridge native drop capability unavailable", {
                    destinationAsset: this.to,
                    postBridgeRecipient,
                    reason: nativeDropFailure.reason,
                    ...this.getNativeDropLogDetails(nativeDropFailure),
                });
                return false;
            }

            log.warn("Post-bridge native drop capability check failed", {
                destinationAsset: this.to,
                postBridgeRecipient,
                error,
            });
            throw error;
        }
    };

    private quoteMessagingFeeCost = async (
        asset: string | undefined,
        quoteDetails:
            | {
                  chain: string;
                  tokenIn: string;
              }
            | undefined,
        msgFee: bigint,
    ): Promise<BigNumber> => {
        if (
            msgFee === 0n ||
            asset === undefined ||
            quoteDetails === undefined
        ) {
            return BigNumber(0);
        }

        try {
            const [quoteRes] = await quoteDexAmountOut(
                quoteDetails.chain,
                quoteDetails.tokenIn,
                ZeroAddress,
                msgFee,
            );

            if (quoteRes === undefined || quoteRes.quote === undefined) {
                throw new Error("undefined quote");
            }

            return fromDexAmount(BigInt(quoteRes.quote), asset);
        } catch (error) {
            log.warn("Could not quote bridge messaging fee cost", {
                asset,
                quoteDetails,
                error,
            });
            return BigNumber(0);
        }
    };

    private applyPreBridgeQuote = async (
        sendAmount: BigNumber,
        sendAmountKey?: string,
    ): Promise<BigNumber> => {
        const pre = this.requirePreBridge();
        if (pre === undefined) {
            return sendAmount;
        }

        if (sendAmount.isNaN()) {
            return BigNumber(0);
        }

        if (sendAmount.isLessThanOrEqualTo(0)) {
            return sendAmount;
        }

        const quote = await pre.driver.quoteReceiveAmount(
            pre.route,
            BigInt(sendAmount.toFixed(0)),
        );

        if (sendAmountKey !== undefined) {
            this.cacheLatestBridgeFee(sendAmountKey, quote);
        }

        return BigNumber(quote.amountOut.toString());
    };

    private invertPreBridgeQuote = async (
        amount: BigNumber,
    ): Promise<{
        amount: BigNumber;
        quote?: BridgeReceiveQuote;
    }> => {
        const pre = this.requirePreBridge();
        if (pre === undefined) {
            return { amount };
        }

        if (amount.isNaN()) {
            return { amount: BigNumber(0) };
        }

        if (amount.isLessThanOrEqualTo(0)) {
            return { amount };
        }

        const requiredAmount = await pre.driver.quoteAmountInForAmountOut(
            pre.route,
            BigInt(amount.toFixed(0)),
        );
        const quote = await pre.driver.quoteReceiveAmount(
            pre.route,
            requiredAmount,
        );

        return {
            amount: BigNumber(requiredAmount.toString()),
            quote,
        };
    };

    private convertClaimAmountToBridgeAmount = async (
        claimAmount: BigNumber,
    ): Promise<BigNumber> => {
        const dexHop = this.postBridgeDexHop;
        if (dexHop === undefined || claimAmount.isLessThanOrEqualTo(0)) {
            return claimAmount;
        }

        const { trade } = await fetchDexQuote(
            dexHop.dexDetails!,
            toDexAmount(claimAmount.toNumber(), dexHop.from),
        );
        return fromDexAmount(trade.amountOut, dexHop.to);
    };

    private convertBridgeAmountToClaimAmount = async (
        bridgeAmount: BigNumber,
    ): Promise<BigNumber> => {
        const dexHop = this.postBridgeDexHop;
        if (dexHop === undefined || bridgeAmount.isLessThanOrEqualTo(0)) {
            return bridgeAmount;
        }

        const [quote] = await quoteDexAmountOut(
            dexHop.dexDetails!.chain,
            dexHop.dexDetails!.tokenIn,
            dexHop.dexDetails!.tokenOut,
            toDexAmount(bridgeAmount.toNumber(), dexHop.to),
        );

        return fromDexAmount(BigInt(quote?.quote ?? 0), dexHop.from);
    };

    private applyPostBridgeQuote = async (
        claimAmount: BigNumber,
        sendAmountKey?: string,
        getGasToken: boolean = false,
        postBridgeRecipient?: string,
    ): Promise<BigNumber> => {
        try {
            const post = this.requirePostBridge();
            if (post === undefined || claimAmount.isLessThanOrEqualTo(0)) {
                return claimAmount;
            }

            log.info("Applying post-bridge quote", {
                sourceAsset: post.route.sourceAsset,
                destinationAsset: this.to,
                claimAmount: claimAmount.toFixed(),
                getGasToken,
                postBridgeRecipient,
            });
            const postBridgeQuoteOptions = await this.getPostBridgeQuoteOptions(
                postBridgeRecipient,
                getGasToken,
            );
            const quotedBridgeAmount =
                await this.convertClaimAmountToBridgeAmount(claimAmount);
            const quote = await post.driver.quoteReceiveAmount(
                post.route,
                BigInt(quotedBridgeAmount.toFixed(0)),
                postBridgeQuoteOptions,
            );
            const messagingFeeCost = await this.quoteMessagingFeeCost(
                this.postBridgeClaimAsset,
                this.postBridgeFeeQuoteDetails,
                quote.msgFee[0],
            );

            log.info("Applied post-bridge quote", {
                destinationAsset: this.to,
                quotedBridgeAmount: quotedBridgeAmount.toFixed(),
                messagingFee: quote.msgFee[0].toString(),
                messagingFeeCost: messagingFeeCost.toFixed(),
                quotedAmountOut: quote.amountOut.toString(),
            });

            const adjustedClaimAmount = claimAmount.minus(messagingFeeCost);
            if (adjustedClaimAmount.isLessThanOrEqualTo(0)) {
                log.info("Post-bridge quote reduced amount to zero", {
                    destinationAsset: this.to,
                    adjustedClaimAmount: adjustedClaimAmount.toFixed(),
                });
                return BigNumber(0);
            }

            const adjustedBridgeAmount =
                await this.convertClaimAmountToBridgeAmount(
                    adjustedClaimAmount,
                );
            const adjustedQuote = await post.driver.quoteReceiveAmount(
                post.route,
                BigInt(adjustedBridgeAmount.toFixed(0)),
                postBridgeQuoteOptions,
            );

            if (sendAmountKey !== undefined) {
                this.cacheLatestBridgeFee(sendAmountKey, adjustedQuote);
            }

            return BigNumber(adjustedQuote.amountOut.toString());
        } catch (error) {
            const nativeDropFailure = this.getNativeDropFailure(
                this.postBridgeDriver,
                error,
            );
            if (getGasToken && nativeDropFailure !== undefined) {
                log.warn(
                    "Falling back to post-bridge quote without native drop",
                    {
                        destinationAsset: this.to,
                        postBridgeRecipient,
                        reason: nativeDropFailure.reason,
                        ...this.getNativeDropLogDetails(nativeDropFailure),
                    },
                );
                return await this.applyPostBridgeQuote(
                    claimAmount,
                    sendAmountKey,
                    false,
                    postBridgeRecipient,
                );
            }

            throw error;
        }
    };

    private invertPostBridgeQuote = async (
        amount: BigNumber,
        getGasToken: boolean = false,
        postBridgeRecipient?: string,
    ): Promise<{
        amount: BigNumber;
        quote?: BridgeReceiveQuote;
    }> => {
        try {
            const post = this.requirePostBridge();
            if (post === undefined || amount.isLessThanOrEqualTo(0)) {
                return { amount };
            }

            log.info("Inverting post-bridge quote", {
                sourceAsset: post.route.sourceAsset,
                destinationAsset: this.to,
                requestedAmount: amount.toFixed(),
                getGasToken,
                postBridgeRecipient,
            });
            const postBridgeQuoteOptions = await this.getPostBridgeQuoteOptions(
                postBridgeRecipient,
                getGasToken,
            );
            const requiredAmount = await post.driver.quoteAmountInForAmountOut(
                post.route,
                BigInt(amount.toFixed(0)),
                postBridgeQuoteOptions,
            );

            const quote = await post.driver.quoteReceiveAmount(
                post.route,
                requiredAmount,
                postBridgeQuoteOptions,
            );
            const requiredClaimAmount =
                await this.convertBridgeAmountToClaimAmount(
                    BigNumber(requiredAmount.toString()),
                );
            const messagingFeeCost = await this.quoteMessagingFeeCost(
                this.postBridgeClaimAsset,
                this.postBridgeFeeQuoteDetails,
                quote.msgFee[0],
            );
            log.info("Inverted post-bridge quote", {
                destinationAsset: this.to,
                requiredAmount: requiredAmount.toString(),
                requiredClaimAmount: requiredClaimAmount.toFixed(),
                messagingFee: quote.msgFee[0].toString(),
                messagingFeeCost: messagingFeeCost.toFixed(),
            });

            return {
                amount: requiredClaimAmount.plus(messagingFeeCost),
                quote,
            };
        } catch (error) {
            const nativeDropFailure = this.getNativeDropFailure(
                this.postBridgeDriver,
                error,
            );
            if (getGasToken && nativeDropFailure !== undefined) {
                log.warn(
                    "Falling back to reverse post-bridge quote without native drop",
                    {
                        destinationAsset: this.to,
                        postBridgeRecipient,
                        reason: nativeDropFailure.reason,
                        ...this.getNativeDropLogDetails(nativeDropFailure),
                    },
                );
                return await this.invertPostBridgeQuote(
                    amount,
                    false,
                    postBridgeRecipient,
                );
            }

            throw error;
        }
    };

    public boltzSwapSendAmountFromLatestQuote = (sendAmount: BigNumber) => {
        if (
            this.preBridge === undefined &&
            this.dexHopBeforeBoltz === undefined
        ) {
            return sendAmount;
        }

        const key = sendAmount.toFixed();

        if (this.latestBoltzSwapSendAmount?.sendAmount !== key) {
            return undefined;
        }

        return this.latestBoltzSwapSendAmount.value;
    };

    public bridgeMessagingFeeFromLatestQuote = (sendAmount: BigNumber) => {
        const key = sendAmount.toFixed();

        if (this.latestBridgeFee?.sendAmount !== key) {
            return undefined;
        }

        return this.latestBridgeFee.messaging?.value;
    };

    public bridgeTransferFeeFromLatestQuote = (sendAmount: BigNumber) => {
        const key = sendAmount.toFixed();

        if (this.latestBridgeFee?.sendAmount !== key) {
            return undefined;
        }

        return this.latestBridgeFee.transfer;
    };

    public get bridgeMessagingFeeToken() {
        return (
            this.latestBridgeFee?.messaging?.token ??
            this.postBridgeMessagingFeeToken ??
            this.preBridgeMessagingFeeToken
        );
    }

    public get bridgeTransferFeeAsset() {
        return (
            (this.postBridge !== undefined
                ? this.postBridgeDriver?.getTransferFeeAsset(this.postBridge)
                : undefined) ??
            (this.preBridge !== undefined
                ? this.preBridgeDriver?.getTransferFeeAsset(this.preBridge)
                : undefined)
        );
    }

    public get bridgeMessagingFeeIncludedInTotal(): boolean {
        return this.postBridge !== undefined;
    }

    public get bridgeMessagingFeeDisplayMode(): BridgeMessagingFeeDisplayMode {
        return this.bridgeMessagingFeeIncludedInTotal
            ? BridgeMessagingFeeDisplayMode.Details
            : BridgeMessagingFeeDisplayMode.Inline;
    }

    private quoteReceiveHop = async (
        amount: BigNumber,
        hop: Hop,
        minerFees: number,
        useDexGasToken: boolean,
    ): Promise<BigNumber> => {
        switch (hop.type) {
            case SwapType.Dex: {
                if (Number.isNaN(amount.toNumber())) {
                    return BigNumber(0);
                }

                const dexInput = toDexAmount(amount.toNumber(), hop.from);
                const gasTokenAmount = useDexGasToken
                    ? await getGasTopUpNativeAmount(this.to)
                    : undefined;

                try {
                    const { trade } = await fetchDexQuote(
                        hop.dexDetails!,
                        dexInput,
                        useDexGasToken,
                        gasTokenAmount,
                    );
                    return fromDexAmount(trade.amountOut, hop.to);
                } catch {
                    return BigNumber(0);
                }
            }

            case SwapType.Submarine:
            case SwapType.Reverse:
            case SwapType.Chain:
                return calculateReceiveAmount(
                    amount,
                    hop.pair!.fees.percentage,
                    minerFees,
                    hop.type,
                );
            default: {
                const exhaustiveCheck: never = hop.type;
                throw new Error(
                    `unsupported hop type encountered: ${String(exhaustiveCheck)}`,
                );
            }
        }
    };

    private convertThroughPrecedingDex = async (
        boltzSendAmount: number,
    ): Promise<number> => {
        const dexHop = this.dexHopBeforeBoltz;
        if (dexHop === undefined) {
            return boltzSendAmount;
        }

        const [quote] = await quoteDexAmountOut(
            dexHop.dexDetails!.chain,
            dexHop.dexDetails!.tokenIn,
            dexHop.dexDetails!.tokenOut,
            toDexAmount(boltzSendAmount, dexHop.to),
        );
        const quoteAmount = BigInt(quote?.quote ?? 0);

        return fromDexAmount(quoteAmount, dexHop.from).toNumber();
    };

    private convertFromBoltzSendAmount = async (
        boltzSendAmount: number,
    ): Promise<number> => {
        const amountBeforeBoltz =
            await this.convertThroughPrecedingDex(boltzSendAmount);
        const preBridgeQuote = await this.invertPreBridgeQuote(
            BigNumber(amountBeforeBoltz),
        );

        return preBridgeQuote.amount.toNumber();
    };

    public getMinimum = async (): Promise<number> => {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return 0;
        }

        let boltzSendLimit: number;

        if (boltzHop.type !== SwapType.Submarine) {
            boltzSendLimit = boltzHop.pair.limits.minimal;
        } else {
            boltzSendLimit = calculateSendAmount(
                BigNumber(
                    (boltzHop.pair as unknown as SubmarinePairTypeTaproot)
                        .limits.minimalBatched || boltzHop.pair.limits.minimal,
                ),
                this.feePercentage,
                this.minerFees,
                boltzHop.type,
            ).toNumber();
        }

        return await this.convertFromBoltzSendAmount(boltzSendLimit);
    };

    public getMaximum = async (): Promise<number> => {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return 0;
        }

        let boltzSendLimit: number;

        if (boltzHop.type !== SwapType.Submarine) {
            boltzSendLimit = boltzHop.pair.limits.maximal;
        } else {
            boltzSendLimit = calculateSendAmount(
                BigNumber(boltzHop.pair.limits.maximal),
                this.feePercentage,
                this.minerFees,
                boltzHop.type,
            ).toNumber();
        }

        return await this.convertFromBoltzSendAmount(boltzSendLimit);
    };

    public get feeWithoutPro() {
        if (this.regularPairs === undefined) {
            return this.feePercentage;
        }

        const fee = this.route
            .filter((hop) => hop.pair !== undefined)
            .reduce((acc, hop) => {
                const pair = Pair.findPair(this.regularPairs, hop.from, hop.to);
                if (pair === undefined) {
                    return acc;
                }

                return acc + pair.pair.fees.percentage;
            }, 0);
        return fee;
    }

    public get swapToCreate() {
        return this.route.find((hop) => hop.type !== SwapType.Dex);
    }

    public feeOnSend = (sendAmount: BigNumber) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return BigNumber(0);
        }

        return calculateBoltzFeeOnSend(
            sendAmount,
            this.feePercentage,
            this.minerFees,
            boltzHop.type,
        );
    };

    public calculateReceiveAmount = async (
        sendAmount: BigNumber,
        // TODO: only include lockup miner fees
        minerFees: number,
        route: Hop[] = this.route,
        getGasToken: boolean = false,
        postBridgeRecipient?: string,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        const boltzHop = this.boltzHop;
        const shouldCacheBoltzSwapSendAmount = route === this.route;
        const sendAmountKey = sendAmount.toFixed();
        const useDexGasToken = this.useDexGasToken(getGasToken);
        const routeToQuote =
            route === this.route ? this.routeWithoutPostBridgeDex : route;
        let amount =
            route === this.route
                ? await this.applyPreBridgeQuote(sendAmount, sendAmountKey)
                : sendAmount;

        for (const hop of routeToQuote) {
            // Cache the amount that will be sent into the Boltz hop for this quote.
            if (
                shouldCacheBoltzSwapSendAmount &&
                boltzHop !== undefined &&
                hop === boltzHop
            ) {
                this.latestBoltzSwapSendAmount = {
                    sendAmount: sendAmountKey,
                    value: amount,
                };
            }

            amount = await this.quoteReceiveHop(
                amount,
                hop,
                minerFees,
                useDexGasToken,
            );
        }

        if (route === this.route) {
            return await this.applyPostBridgeQuote(
                amount,
                sendAmountKey,
                getGasToken,
                postBridgeRecipient,
            );
        }

        return amount;
    };

    public calculatePostBoltzReceiveAmount = async (
        boltzReceiveAmount: BigNumber,
        getGasToken: boolean = false,
        postBridgeRecipient?: string,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return BigNumber(0);
        }

        const boltzIndex = this.route.indexOf(boltzHop);
        const postBoltzRoute = this.route.slice(boltzIndex + 1);
        const routeToQuote =
            this.postBridgeDexHop !== undefined &&
            postBoltzRoute[postBoltzRoute.length - 1] === this.postBridgeDexHop
                ? postBoltzRoute.slice(0, -1)
                : postBoltzRoute;
        const useDexGasToken = this.useDexGasToken(getGasToken);
        let amount = boltzReceiveAmount;

        for (const hop of routeToQuote) {
            amount = await this.quoteReceiveHop(amount, hop, 0, useDexGasToken);
        }

        if (this.postBridge !== undefined) {
            return await this.applyPostBridgeQuote(
                amount,
                undefined,
                getGasToken,
                postBridgeRecipient,
            );
        }

        return amount;
    };

    public calculateSendAmount = async (
        receiveAmount: BigNumber,
        minerFees: number,
        getGasToken: boolean = false,
        postBridgeRecipient?: string,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        const boltzHop = this.boltzHop;
        let boltzSwapSendAmountForCache: BigNumber | undefined;
        const routeToQuote = this.routeWithoutPostBridgeDex;
        const useDexGasToken = this.useDexGasToken(getGasToken);

        const postBridgeQuote = await this.invertPostBridgeQuote(
            receiveAmount,
            getGasToken,
            postBridgeRecipient,
        );
        let amount = postBridgeQuote.amount;

        for (const hop of [...routeToQuote].reverse()) {
            switch (hop.type) {
                case SwapType.Dex: {
                    const [quote] = await quoteDexAmountOut(
                        hop.dexDetails!.chain,
                        hop.dexDetails!.tokenIn,
                        hop.dexDetails!.tokenOut,
                        toDexAmount(amount.toNumber(), hop.to),
                    );
                    let quoteAmount = BigInt(quote?.quote ?? 0);

                    if (useDexGasToken) {
                        const gasTokenAmount = await getGasTopUpNativeAmount(
                            this.to,
                        );
                        const gasQuote = await fetchGasTokenQuote(
                            hop.dexDetails!,
                            gasTokenAmount,
                        );
                        quoteAmount += gasQuote.amountIn;
                    }

                    amount = fromDexAmount(quoteAmount, hop.from);
                    break;
                }

                default:
                    amount = calculateSendAmount(
                        amount,
                        hop.pair!.fees.percentage,
                        minerFees,
                        hop.type,
                    );

                    if (boltzHop !== undefined && hop === boltzHop) {
                        boltzSwapSendAmountForCache = amount;
                    }
            }
        }

        const preBridgeQuote = await this.invertPreBridgeQuote(amount);
        amount = preBridgeQuote.amount;

        // Cache using the final user send amount as key.
        const sendAmountKey = amount.toFixed();
        this.latestBoltzSwapSendAmount = {
            sendAmount: sendAmountKey,
            value: boltzSwapSendAmountForCache ?? amount,
        };
        const quote = preBridgeQuote.quote ?? postBridgeQuote.quote;
        if (quote !== undefined) {
            this.cacheLatestBridgeFee(sendAmountKey, quote);
        }

        return amount;
    };

    public creationData = async (
        sendAmount: BigNumber,
        minerFees: number,
    ): Promise<CreationData | undefined> => {
        const boltzHop = this.boltzHop;
        if (boltzHop === undefined) {
            return undefined;
        }

        // If the first hop is a DEX, calculate the intermediate amount
        const firstHop = this.route[0];
        let boltzSendAmount =
            this.boltzSwapSendAmountFromLatestQuote(sendAmount) ?? sendAmount;
        if (boltzSendAmount === sendAmount && this.preBridge !== undefined) {
            boltzSendAmount = await this.applyPreBridgeQuote(sendAmount);
        }

        if (
            firstHop.type === SwapType.Dex &&
            this.boltzSwapSendAmountFromLatestQuote(sendAmount) === undefined
        ) {
            // Reuse the exact Boltz input from the latest reverse quote when available.
            // Requoting the DEX hop forward can round down by 1 and drift from swap creation.
            boltzSendAmount = await this.calculateReceiveAmount(
                boltzSendAmount,
                minerFees,
                [firstHop],
            );
        }

        const receiveAmount = await this.calculateReceiveAmount(
            boltzSendAmount,
            minerFees,
            [boltzHop],
        );

        const dexHops = this.route.filter((hop) => hop.type === SwapType.Dex);
        const boltzIndex = this.route.indexOf(boltzHop);
        return {
            type: boltzHop.type,
            sendAmount: boltzSendAmount,
            receiveAmount,
            from: coalesceLn(boltzHop.from),
            to: coalesceLn(boltzHop.to),
            pairHash: boltzHop.pair!.hash,
            hops: dexHops.map(toEncodedHop),
            hopsPosition:
                dexHops.length > 0
                    ? this.route.indexOf(dexHops[0]) < boltzIndex
                        ? SwapPosition.Pre
                        : SwapPosition.Post
                    : undefined,
        };
    };
}
