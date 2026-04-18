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
    USDT0,
    getCanonicalAsset,
    getUsdt0Mesh,
    isEvmAsset,
    isUsdt0Asset,
    isUsdt0Variant,
} from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import {
    type ChainPairTypeTaproot,
    type Pairs,
    type ReversePairTypeTaproot,
    type SubmarinePairTypeTaproot,
    quoteDexAmountOut,
} from "./boltzClient";
import {
    calculateBoltzFeeOnSend,
    calculateReceiveAmount,
    calculateSendAmount,
} from "./calculate";
import { coalesceLn } from "./helper";
import {
    type OftQuoteOptions,
    type OftReceiveQuote,
    decodeExecutorNativeAmountExceedsCapError,
    isExecutorNativeAmountExceedsCapError,
    quoteOftAmountInForAmountOut,
    quoteOftReceiveAmount,
} from "./oft/oft";
import type { OftRoute } from "./oft/types";
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
    config.assets[asset]?.token?.routeVia !== undefined || isUsdt0Asset(asset);

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
    private readonly preOft: OftRoute | undefined;
    private readonly postOft: OftRoute | undefined;
    private latestBoltzSwapSendAmount:
        | {
              sendAmount: string;
              value: BigNumber;
          }
        | undefined;
    private latestOftFee:
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
                isUsdt0Asset(from) ||
                isUsdt0Asset(to))
        ) {
            log.info("TBTC and USDT0 pairs are disabled on Tor");
            return;
        }

        const routeSource = getCanonicalAsset(from);
        const routeTarget = getCanonicalAsset(to);
        this.preOft =
            isUsdt0Variant(from) &&
            routeSource === USDT0 &&
            config.assets?.[routeSource] !== undefined
                ? {
                      sourceAsset: from,
                      destinationAsset: routeSource,
                  }
                : undefined;
        const postOft =
            isUsdt0Variant(to) &&
            routeTarget === USDT0 &&
            config.assets?.[to] !== undefined
                ? {
                      sourceAsset: routeTarget,
                      destinationAsset: to,
                  }
                : undefined;
        this.postOft = postOft;

        const pair = Pair.findPair(pairs, routeSource, routeTarget);
        if (pair !== undefined) {
            log.debug(`Found direct pair for ${from} -> ${routeTarget}`);
            this.route = [
                {
                    type: pair.type,
                    pair: pair.pair,
                    from: routeSource,
                    to: routeTarget,
                },
            ];
            return;
        }

        const toAsset = config.assets[routeTarget];
        if (toAsset !== undefined && toAsset.type === AssetKind.ERC20) {
            const hopAssetSymbol = toAsset.token?.routeVia;
            const hopAsset = config.assets[hopAssetSymbol];
            const hopPair =
                hopAssetSymbol !== undefined
                    ? Pair.findPair(pairs, routeSource, hopAssetSymbol)
                    : undefined;

            if (hopPair !== undefined && hopAsset !== undefined) {
                log.debug(
                    `Found route for ${from} -> ${hopAssetSymbol} -> ${routeTarget}`,
                );
                this.route = [
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
                            tokenOut: toAsset.token?.address,
                        },
                    },
                ];
                return;
            }
        }

        const fromAsset = config.assets[routeSource];
        if (fromAsset !== undefined && fromAsset.type === AssetKind.ERC20) {
            const hopAssetSymbol = fromAsset.token?.routeVia;
            const hopAsset = config.assets[hopAssetSymbol];
            const hopPair =
                hopAssetSymbol !== undefined
                    ? Pair.findPair(pairs, hopAssetSymbol, routeTarget)
                    : undefined;

            if (hopPair !== undefined && hopAsset !== undefined) {
                log.debug(
                    `Found route for ${from} -> ${hopAssetSymbol} -> ${routeTarget}`,
                );
                this.route = [
                    {
                        type: SwapType.Dex,
                        from: routeSource,
                        to: hopAssetSymbol,
                        dexDetails: {
                            chain: fromAsset.network?.symbol,
                            tokenIn: fromAsset.token?.address,
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
                return;
            }
        }

        log.info(`No pair found for ${from} -> ${to}`);
    }

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
            this.preOft !== undefined ||
            this.postOft !== undefined ||
            this.route.some((hop) => hop.type === SwapType.Dex)
        );
    }

    public get requiredInput() {
        if (!this.isRoutable) {
            return RequiredInput.Unknown;
        }

        if (this.postOft !== undefined) {
            return isEvmAsset(this.postOft.destinationAsset)
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

    public get hasPreOft() {
        return this.preOft !== undefined;
    }

    public get hasPostOft() {
        return this.postOft !== undefined;
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

        if (this.preOft !== undefined) {
            blockers.push("pre-OFT routing is enabled");
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
                hasPreOft: this.preOft !== undefined,
                hasPostOft: this.postOft !== undefined,
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

    private get postOftDexHop(): Hop | undefined {
        if (this.postOft === undefined || this.route.length === 0) {
            return undefined;
        }

        const lastHop = this.route[this.route.length - 1];
        return lastHop.type === SwapType.Dex ? lastHop : undefined;
    }

    private get routeWithoutPostOftDex(): Hop[] {
        return this.postOftDexHop !== undefined
            ? this.route.slice(0, -1)
            : this.route;
    }

    private get preOftMessagingFeeToken() {
        return this.preOft !== undefined
            ? config.assets?.[this.preOft.sourceAsset]?.network?.gasToken
            : undefined;
    }

    private get postOftMessagingFeeToken() {
        return this.postOft !== undefined
            ? config.assets?.[this.postOft.sourceAsset]?.network?.gasToken
            : undefined;
    }

    private cacheLatestOftFee = (
        sendAmountKey: string,
        quote: OftReceiveQuote,
    ) => {
        this.latestOftFee = {
            sendAmount: sendAmountKey,
            messaging: {
                value: quote.msgFee[0],
                token: this.oftMessagingFeeToken,
            },
            transfer: BigNumber((quote.amountIn - quote.amountOut).toString()),
        };
    };

    private get postOftClaimAsset() {
        return this.postOftDexHop?.from ?? this.postOft?.sourceAsset;
    }

    private get postOftFeeQuoteDetails():
        | {
              chain: string;
              tokenIn: string;
          }
        | undefined {
        const claimAsset = this.postOftClaimAsset;
        if (claimAsset === undefined) {
            return undefined;
        }

        const claimAssetConfig = config.assets?.[claimAsset];
        const chain =
            this.postOftDexHop?.dexDetails?.chain ??
            claimAssetConfig?.network?.symbol;
        const tokenIn =
            this.postOftDexHop?.dexDetails?.tokenIn ??
            claimAssetConfig?.token?.address;

        if (chain === undefined || tokenIn === undefined) {
            return undefined;
        }

        return {
            chain,
            tokenIn,
        };
    }

    private getPostOftQuoteOptions = async (
        postOftRecipient?: string,
        getGasToken: boolean = false,
    ): Promise<OftQuoteOptions | undefined> => {
        if (
            this.postOft === undefined ||
            postOftRecipient === undefined ||
            postOftRecipient === ""
        ) {
            return undefined;
        }

        const nativeDropAmount =
            getGasToken && gasTopUpSupported(this.to)
                ? await getGasTopUpNativeAmount(this.to)
                : undefined;
        log.info("Built post-OFT quote options", {
            destinationAsset: this.to,
            postOftRecipient,
            getGasToken,
            nativeDropAmount: nativeDropAmount?.toString(),
        });
        return {
            recipient: postOftRecipient,
            nativeDrop:
                nativeDropAmount !== undefined
                    ? {
                          amount: nativeDropAmount,
                          receiver: postOftRecipient,
                      }
                    : undefined,
        };
    };

    public canPostOftNativeDrop = async (
        postOftRecipient?: string,
    ): Promise<boolean> => {
        if (
            this.postOft === undefined ||
            postOftRecipient === undefined ||
            postOftRecipient === "" ||
            !gasTopUpSupported(this.to)
        ) {
            log.info("Post-OFT native drop capability check skipped", {
                destinationAsset: this.to,
                postOftRecipient,
                hasPostOft: this.postOft !== undefined,
                gasTopUpSupported: gasTopUpSupported(this.to),
            });
            return false;
        }

        try {
            log.info("Checking post-OFT native drop capability", {
                sourceAsset: this.postOft.sourceAsset,
                destinationAsset: this.to,
                destinationMeshKind: getUsdt0Mesh(
                    this.postOft.sourceAsset,
                    this.postOft.destinationAsset,
                ),
                postOftRecipient,
            });
            await quoteOftReceiveAmount(
                this.postOft,
                1n,
                await this.getPostOftQuoteOptions(postOftRecipient, true),
            );
            log.info("Post-OFT native drop capability confirmed", {
                destinationAsset: this.to,
                postOftRecipient,
            });
            return true;
        } catch (error) {
            if (isExecutorNativeAmountExceedsCapError(error)) {
                const decoded =
                    decodeExecutorNativeAmountExceedsCapError(error);
                log.warn("Post-OFT native drop exceeds executor cap", {
                    destinationAsset: this.to,
                    postOftRecipient,
                    amount: decoded?.amount.toString(),
                    cap: decoded?.cap.toString(),
                });
                return false;
            }

            log.warn("Post-OFT native drop capability check failed", {
                destinationAsset: this.to,
                postOftRecipient,
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
            log.warn("Could not quote OFT messaging fee cost", {
                asset,
                quoteDetails,
                error,
            });
            return BigNumber(0);
        }
    };

    private applyPreOftQuote = async (
        sendAmount: BigNumber,
        sendAmountKey?: string,
    ): Promise<BigNumber> => {
        if (this.preOft === undefined) {
            return sendAmount;
        }

        if (sendAmount.isNaN()) {
            return BigNumber(0);
        }

        if (sendAmount.isLessThanOrEqualTo(0)) {
            return sendAmount;
        }

        const quote = await quoteOftReceiveAmount(
            this.preOft,
            BigInt(sendAmount.toFixed(0)),
        );

        if (sendAmountKey !== undefined) {
            this.cacheLatestOftFee(sendAmountKey, quote);
        }

        return BigNumber(quote.amountOut.toString());
    };

    private invertPreOftQuote = async (
        amount: BigNumber,
    ): Promise<{
        amount: BigNumber;
        quote?: OftReceiveQuote;
    }> => {
        if (this.preOft === undefined) {
            return { amount };
        }

        if (amount.isNaN()) {
            return { amount: BigNumber(0) };
        }

        if (amount.isLessThanOrEqualTo(0)) {
            return { amount };
        }

        const requiredAmount = await quoteOftAmountInForAmountOut(
            this.preOft,
            BigInt(amount.toFixed(0)),
        );
        const quote = await quoteOftReceiveAmount(this.preOft, requiredAmount);

        return {
            amount: BigNumber(requiredAmount.toString()),
            quote,
        };
    };

    private convertClaimAmountToOftAmount = async (
        claimAmount: BigNumber,
    ): Promise<BigNumber> => {
        const dexHop = this.postOftDexHop;
        if (dexHop === undefined || claimAmount.isLessThanOrEqualTo(0)) {
            return claimAmount;
        }

        const { trade } = await fetchDexQuote(
            dexHop.dexDetails!,
            toDexAmount(claimAmount.toNumber(), dexHop.from),
        );
        return fromDexAmount(trade.amountOut, dexHop.to);
    };

    private convertOftAmountToClaimAmount = async (
        oftAmount: BigNumber,
    ): Promise<BigNumber> => {
        const dexHop = this.postOftDexHop;
        if (dexHop === undefined || oftAmount.isLessThanOrEqualTo(0)) {
            return oftAmount;
        }

        const [quote] = await quoteDexAmountOut(
            dexHop.dexDetails!.chain,
            dexHop.dexDetails!.tokenIn,
            dexHop.dexDetails!.tokenOut,
            toDexAmount(oftAmount.toNumber(), dexHop.to),
        );

        return fromDexAmount(BigInt(quote?.quote ?? 0), dexHop.from);
    };

    private applyPostOftQuote = async (
        claimAmount: BigNumber,
        sendAmountKey?: string,
        getGasToken: boolean = false,
        postOftRecipient?: string,
    ): Promise<BigNumber> => {
        try {
            if (
                this.postOft === undefined ||
                claimAmount.isLessThanOrEqualTo(0)
            ) {
                return claimAmount;
            }

            log.info("Applying post-OFT quote", {
                sourceAsset: this.postOft.sourceAsset,
                destinationAsset: this.to,
                destinationMeshKind: getUsdt0Mesh(
                    this.postOft.sourceAsset,
                    this.postOft.destinationAsset,
                ),
                claimAmount: claimAmount.toFixed(),
                getGasToken,
                postOftRecipient,
            });
            const postOftQuoteOptions = await this.getPostOftQuoteOptions(
                postOftRecipient,
                getGasToken,
            );
            const quotedOftAmount =
                await this.convertClaimAmountToOftAmount(claimAmount);
            const quote = await quoteOftReceiveAmount(
                this.postOft,
                BigInt(quotedOftAmount.toFixed(0)),
                postOftQuoteOptions,
            );
            const messagingFeeCost = await this.quoteMessagingFeeCost(
                this.postOftClaimAsset,
                this.postOftFeeQuoteDetails,
                quote.msgFee[0],
            );

            log.info("Applied post-OFT quote", {
                destinationAsset: this.to,
                quotedOftAmount: quotedOftAmount.toFixed(),
                messagingFee: quote.msgFee[0].toString(),
                messagingFeeCost: messagingFeeCost.toFixed(),
                quotedAmountOut: quote.amountOut.toString(),
            });

            const adjustedClaimAmount = claimAmount.minus(messagingFeeCost);
            if (adjustedClaimAmount.isLessThanOrEqualTo(0)) {
                log.info("Post-OFT quote reduced amount to zero", {
                    destinationAsset: this.to,
                    adjustedClaimAmount: adjustedClaimAmount.toFixed(),
                });
                return BigNumber(0);
            }

            const adjustedOftAmount =
                await this.convertClaimAmountToOftAmount(adjustedClaimAmount);
            const adjustedQuote = await quoteOftReceiveAmount(
                this.postOft,
                BigInt(adjustedOftAmount.toFixed(0)),
                postOftQuoteOptions,
            );

            if (sendAmountKey !== undefined) {
                this.cacheLatestOftFee(sendAmountKey, adjustedQuote);
            }

            return BigNumber(adjustedQuote.amountOut.toString());
        } catch (error) {
            if (getGasToken && isExecutorNativeAmountExceedsCapError(error)) {
                const decoded =
                    decodeExecutorNativeAmountExceedsCapError(error);
                log.warn("Falling back to post-OFT quote without native drop", {
                    destinationAsset: this.to,
                    postOftRecipient,
                    amount: decoded?.amount.toString(),
                    cap: decoded?.cap.toString(),
                });
                return await this.applyPostOftQuote(
                    claimAmount,
                    sendAmountKey,
                    false,
                    postOftRecipient,
                );
            }

            throw error;
        }
    };

    private invertPostOftQuote = async (
        amount: BigNumber,
        getGasToken: boolean = false,
        postOftRecipient?: string,
    ): Promise<{
        amount: BigNumber;
        quote?: OftReceiveQuote;
    }> => {
        try {
            if (this.postOft === undefined || amount.isLessThanOrEqualTo(0)) {
                return { amount };
            }

            log.info("Inverting post-OFT quote", {
                sourceAsset: this.postOft.sourceAsset,
                destinationAsset: this.to,
                destinationMeshKind: getUsdt0Mesh(
                    this.postOft.sourceAsset,
                    this.postOft.destinationAsset,
                ),
                requestedAmount: amount.toFixed(),
                getGasToken,
                postOftRecipient,
            });
            const postOftQuoteOptions = await this.getPostOftQuoteOptions(
                postOftRecipient,
                getGasToken,
            );
            const requiredAmount = await quoteOftAmountInForAmountOut(
                this.postOft,
                BigInt(amount.toFixed(0)),
                postOftQuoteOptions,
            );

            const quote = await quoteOftReceiveAmount(
                this.postOft,
                requiredAmount,
                postOftQuoteOptions,
            );
            const requiredClaimAmount =
                await this.convertOftAmountToClaimAmount(
                    BigNumber(requiredAmount.toString()),
                );
            const messagingFeeCost = await this.quoteMessagingFeeCost(
                this.postOftClaimAsset,
                this.postOftFeeQuoteDetails,
                quote.msgFee[0],
            );
            log.info("Inverted post-OFT quote", {
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
            if (getGasToken && isExecutorNativeAmountExceedsCapError(error)) {
                const decoded =
                    decodeExecutorNativeAmountExceedsCapError(error);
                log.warn(
                    "Falling back to reverse post-OFT quote without native drop",
                    {
                        destinationAsset: this.to,
                        postOftRecipient,
                        amount: decoded?.amount.toString(),
                        cap: decoded?.cap.toString(),
                    },
                );
                return await this.invertPostOftQuote(
                    amount,
                    false,
                    postOftRecipient,
                );
            }

            throw error;
        }
    };

    public boltzSwapSendAmountFromLatestQuote = (sendAmount: BigNumber) => {
        if (this.preOft === undefined && this.dexHopBeforeBoltz === undefined) {
            return sendAmount;
        }

        const key = sendAmount.toFixed();

        if (this.latestBoltzSwapSendAmount?.sendAmount !== key) {
            return undefined;
        }

        return this.latestBoltzSwapSendAmount.value;
    };

    public oftMessagingFeeFromLatestQuote = (sendAmount: BigNumber) => {
        const key = sendAmount.toFixed();

        if (this.latestOftFee?.sendAmount !== key) {
            return undefined;
        }

        return this.latestOftFee.messaging?.value;
    };

    public oftTransferFeeFromLatestQuote = (sendAmount: BigNumber) => {
        const key = sendAmount.toFixed();

        if (this.latestOftFee?.sendAmount !== key) {
            return undefined;
        }

        return this.latestOftFee.transfer;
    };

    public get oftMessagingFeeToken() {
        return (
            this.latestOftFee?.messaging?.token ??
            this.postOftMessagingFeeToken ??
            this.preOftMessagingFeeToken
        );
    }

    public get oftTransferFeeAsset() {
        return this.postOft?.sourceAsset ?? this.preOft?.sourceAsset;
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
        const preOftQuote = await this.invertPreOftQuote(
            BigNumber(amountBeforeBoltz),
        );

        return preOftQuote.amount.toNumber();
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
        postOftRecipient?: string,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        const boltzHop = this.boltzHop;
        const shouldCacheBoltzSwapSendAmount = route === this.route;
        const sendAmountKey = sendAmount.toFixed();
        const useDexGasToken =
            getGasToken &&
            this.postOft === undefined &&
            gasTopUpSupported(this.to);
        const routeToQuote =
            route === this.route ? this.routeWithoutPostOftDex : route;
        let amount =
            route === this.route
                ? await this.applyPreOftQuote(sendAmount, sendAmountKey)
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
            return await this.applyPostOftQuote(
                amount,
                sendAmountKey,
                getGasToken,
                postOftRecipient,
            );
        }

        return amount;
    };

    public calculatePostBoltzReceiveAmount = async (
        boltzReceiveAmount: BigNumber,
        getGasToken: boolean = false,
        postOftRecipient?: string,
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
            this.postOftDexHop !== undefined &&
            postBoltzRoute[postBoltzRoute.length - 1] === this.postOftDexHop
                ? postBoltzRoute.slice(0, -1)
                : postBoltzRoute;
        const useDexGasToken =
            getGasToken &&
            this.postOft === undefined &&
            gasTopUpSupported(this.to);
        let amount = boltzReceiveAmount;

        for (const hop of routeToQuote) {
            amount = await this.quoteReceiveHop(amount, hop, 0, useDexGasToken);
        }

        if (this.postOft !== undefined) {
            return await this.applyPostOftQuote(
                amount,
                undefined,
                getGasToken,
                postOftRecipient,
            );
        }

        return amount;
    };

    public calculateSendAmount = async (
        receiveAmount: BigNumber,
        minerFees: number,
        getGasToken: boolean = false,
        postOftRecipient?: string,
    ) => {
        if (!this.isRoutable) {
            return BigNumber(0);
        }

        const boltzHop = this.boltzHop;
        let boltzSwapSendAmountForCache: BigNumber | undefined;
        const routeToQuote = this.routeWithoutPostOftDex;
        const useDexGasToken =
            getGasToken &&
            this.postOft === undefined &&
            gasTopUpSupported(this.to);

        const postOftQuote = await this.invertPostOftQuote(
            receiveAmount,
            getGasToken,
            postOftRecipient,
        );
        let amount = postOftQuote.amount;

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

        const preOftQuote = await this.invertPreOftQuote(amount);
        amount = preOftQuote.amount;

        // Cache using the final user send amount as key.
        const sendAmountKey = amount.toFixed();
        this.latestBoltzSwapSendAmount = {
            sendAmount: sendAmountKey,
            value: boltzSwapSendAmountForCache ?? amount,
        };
        const quote = preOftQuote.quote ?? postOftQuote.quote;
        if (quote !== undefined) {
            this.cacheLatestOftFee(sendAmountKey, quote);
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
        if (boltzSendAmount === sendAmount && this.preOft !== undefined) {
            boltzSendAmount = await this.applyPreOftQuote(sendAmount);
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
