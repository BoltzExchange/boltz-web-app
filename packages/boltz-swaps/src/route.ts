import {
    type BridgeDriver,
    type BridgeQuoteOptions,
    type BridgeReceiveQuote,
    type BridgeRoute,
    bridgeRegistry,
} from "./bridge/index.ts";
import {
    type ChainPairTypeTaproot,
    DexQuoteDirection,
    type Pairs,
    type QuoteData,
    quoteDexAmountIn,
    quoteDexAmountOut,
} from "./client.ts";
import {
    getAssetBridge,
    getBoltzSwapsConfig,
    getCanonicalAsset,
    getKindForAsset,
    getRouteViaAsset,
} from "./config.ts";
import { assetAmountToSats, satsToAssetAmount } from "./evm/rootstock.ts";
import type { OftFeeDetail, OftLimit } from "./oft/index.ts";
import { AssetKind, SwapType } from "./types.ts";

export enum RouteLegKind {
    ChainSwap = "chain-swap",
    Dex = "dex",
    Bridge = "bridge",
}

export class RouteUnavailableError extends Error {
    public override readonly name = "RouteUnavailableError";

    public constructor(
        public readonly reason: string,
        public readonly from: string,
        public readonly to: string,
    ) {
        super(`route ${from} -> ${to}: ${reason}`);
    }
}

export type RouteChainSwapLeg<A extends string = string> = {
    kind: RouteLegKind.ChainSwap;
    from: A;
    to: A;
    sendAmount: bigint;
    receiveAmount: bigint;
    fees: {
        percentage: number;
        minerFees: {
            server: number;
            userLockup: number;
            userClaim: number;
        };
    };
};

export type RouteDexLeg = {
    kind: RouteLegKind.Dex;
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    amountOut: bigint;
    quote: QuoteData;
};

export type RouteBridgeLeg<A extends string = string> = {
    kind: RouteLegKind.Bridge;
    route: BridgeRoute<A>;
    amountIn: bigint;
    amountOut: bigint;
    messagingFee?: { amount: bigint; token?: string };
    bridgeLimit?: OftLimit;
    bridgeFeeDetails?: OftFeeDetail[];
};

export type RouteLeg<A extends string = string> =
    | RouteChainSwapLeg<A>
    | RouteDexLeg
    | RouteBridgeLeg<A>;

export type RouteQuote<A extends string = string> = {
    from: A;
    to: A;
    sendAmount: bigint;
    receiveAmount: bigint;
    legs: RouteLeg<A>[];
};

type RouteQuoteSharedArgs<A extends string> = {
    from: A;
    to: A;
    pairs: Pairs;
    quoteOptions?: BridgeQuoteOptions;
    recipient?: string;
};

export type RouteQuoteAmountOutArgs<A extends string = string> =
    RouteQuoteSharedArgs<A> & {
        amountIn: bigint;
    };

export type RouteQuoteAmountInArgs<A extends string = string> =
    RouteQuoteSharedArgs<A> & {
        amountOut: bigint;
    };

type DexPlan = {
    chain: string;
    tokenIn: string;
    tokenOut: string;
};

type BridgePlan = {
    route: BridgeRoute;
    driver: BridgeDriver;
};

type LegPlan = {
    chainSwap: {
        from: string;
        to: string;
        pair: ChainPairTypeTaproot;
    };
    dex?: DexPlan;
    bridge?: BridgePlan;
};

// percentage is e.g. 0.1 for 0.1%. Scale factor of 1_000_000 keeps 6
// decimals of precision while staying in integer math.
const percentageScale = 1_000_000n;
const percentageScaleNumber = Number(percentageScale);

const ceilDiv = (numerator: bigint, denominator: bigint): bigint =>
    (numerator + denominator - 1n) / denominator;

const chainPairMinerFee = (pair: ChainPairTypeTaproot): bigint =>
    BigInt(pair.fees.minerFees.server) + BigInt(pair.fees.minerFees.user.claim);

export const applyChainPairReceiveAmount = (
    sendAmount: bigint,
    pair: ChainPairTypeTaproot,
): bigint => {
    const scaledPercentage = BigInt(
        Math.round(pair.fees.percentage * percentageScaleNumber),
    );
    const feeNumerator = sendAmount * scaledPercentage;
    const feeDenominator = percentageScale * 100n;
    const percentageFee = ceilDiv(feeNumerator, feeDenominator);
    const minerFee = chainPairMinerFee(pair);
    const receive = sendAmount - percentageFee - minerFee;
    return receive < 0n ? 0n : receive;
};

export const applyChainPairSendAmount = (
    receiveAmount: bigint,
    pair: ChainPairTypeTaproot,
): bigint => {
    const scaledPercentage = BigInt(
        Math.round(pair.fees.percentage * percentageScaleNumber),
    );
    const minerFee = chainPairMinerFee(pair);
    const numerator = (receiveAmount + minerFee) * percentageScale * 100n;
    const denominator = percentageScale * 100n - scaledPercentage;
    return ceilDiv(numerator, denominator);
};

const toAssetBaseUnits = (sats: bigint, asset: string): bigint =>
    getKindForAsset(asset) === AssetKind.UTXO
        ? sats
        : satsToAssetAmount(sats, asset);

const toSats = (amount: bigint, asset: string): bigint =>
    getKindForAsset(asset) === AssetKind.UTXO
        ? amount
        : assetAmountToSats(amount, asset);

const requireAsset = (asset: string) => {
    const config = getBoltzSwapsConfig().assets?.[asset];
    if (config === undefined) {
        throw new Error(`unknown asset: ${asset}`);
    }
    return config;
};

const resolveBridgePlan = (
    to: string,
): { landingAsset: string; bridge?: BridgePlan } => {
    const bridge = getAssetBridge(to);
    const canonical = getCanonicalAsset(to);
    if (bridge === undefined || canonical === to) {
        return { landingAsset: to };
    }
    const route: BridgeRoute = {
        sourceAsset: canonical,
        destinationAsset: to,
    };
    return {
        landingAsset: canonical,
        bridge: {
            route,
            driver: bridgeRegistry.requireDriverForRoute(route),
        },
    };
};

const planLegs = (from: string, to: string, pairs: Pairs): LegPlan => {
    const { landingAsset, bridge } = resolveBridgePlan(to);

    const direct = pairs[SwapType.Chain]?.[from]?.[landingAsset];
    if (direct !== undefined) {
        return {
            chainSwap: { from, to: landingAsset, pair: direct },
            bridge,
        };
    }

    const viaAsset = getRouteViaAsset(landingAsset);
    if (viaAsset === undefined) {
        throw new RouteUnavailableError(
            `no chain-swap pair from ${from} to ${landingAsset} and no route-via asset configured`,
            from,
            to,
        );
    }

    const viaPair = pairs[SwapType.Chain]?.[from]?.[viaAsset];
    if (viaPair === undefined) {
        throw new RouteUnavailableError(
            `no chain-swap pair from ${from} to via-asset ${viaAsset}`,
            from,
            to,
        );
    }

    const viaConfig = requireAsset(viaAsset);
    const landingConfig = requireAsset(landingAsset);
    if (
        viaConfig.network?.symbol === undefined ||
        viaConfig.token?.address === undefined ||
        landingConfig.token?.address === undefined
    ) {
        throw new RouteUnavailableError(
            `via-asset ${viaAsset} or landing-asset ${landingAsset} missing DEX route metadata`,
            from,
            to,
        );
    }

    return {
        chainSwap: { from, to: viaAsset, pair: viaPair },
        dex: {
            chain: viaConfig.network.symbol,
            tokenIn: viaConfig.token.address,
            tokenOut: landingConfig.token.address,
        },
        bridge,
    };
};

const buildChainSwapLeg = (
    plan: LegPlan["chainSwap"],
    sendAmount: bigint,
    receiveAmount: bigint,
): RouteChainSwapLeg => ({
    kind: RouteLegKind.ChainSwap,
    from: plan.from,
    to: plan.to,
    sendAmount,
    receiveAmount,
    fees: {
        percentage: plan.pair.fees.percentage,
        minerFees: {
            server: plan.pair.fees.minerFees.server,
            userLockup: plan.pair.fees.minerFees.user.lockup,
            userClaim: plan.pair.fees.minerFees.user.claim,
        },
    },
});

const buildBridgeLeg = (
    route: BridgeRoute,
    quote: BridgeReceiveQuote,
): RouteBridgeLeg => {
    const leg: RouteBridgeLeg = {
        kind: RouteLegKind.Bridge,
        route,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
    };
    if (quote.messagingFee !== undefined) {
        leg.messagingFee = {
            amount: quote.messagingFee.amount,
            token: quote.messagingFee.token,
        };
    }
    if (quote.bridgeLimit !== undefined) {
        leg.bridgeLimit = quote.bridgeLimit;
    }
    if (quote.bridgeFeeDetails !== undefined) {
        leg.bridgeFeeDetails = quote.bridgeFeeDetails;
    }
    return leg;
};

const pickFirstQuote = (
    quotes: QuoteData[],
    direction: DexQuoteDirection,
    from: string,
    to: string,
): QuoteData => {
    const [best] = quotes;
    if (best === undefined) {
        throw new RouteUnavailableError(
            `no DEX ${direction === DexQuoteDirection.In ? "forward" : "reverse"} quotes returned`,
            from,
            to,
        );
    }
    return best;
};

export const quoteRouteAmountOut = async <A extends string = string>(
    args: RouteQuoteAmountOutArgs<A>,
): Promise<RouteQuote<A>> => {
    const { from, to, pairs, amountIn, quoteOptions, recipient } = args;
    const plan = planLegs(from, to, pairs);

    const chainSwapOutSats = applyChainPairReceiveAmount(
        amountIn,
        plan.chainSwap.pair,
    );
    const chainSwapOut = toAssetBaseUnits(chainSwapOutSats, plan.chainSwap.to);
    const chainLeg = buildChainSwapLeg(plan.chainSwap, amountIn, chainSwapOut);
    const legs: RouteLeg[] = [chainLeg];
    let runningAmount = chainSwapOut;

    if (plan.dex !== undefined) {
        const quotes = await quoteDexAmountIn(
            plan.dex.chain,
            plan.dex.tokenIn,
            plan.dex.tokenOut,
            runningAmount,
        );
        const best = pickFirstQuote(quotes, DexQuoteDirection.In, from, to);
        const dexOut = BigInt(best.quote);
        legs.push({
            kind: RouteLegKind.Dex,
            chain: plan.dex.chain,
            tokenIn: plan.dex.tokenIn,
            tokenOut: plan.dex.tokenOut,
            amountIn: runningAmount,
            amountOut: dexOut,
            quote: best,
        });
        runningAmount = dexOut;
    }

    if (plan.bridge !== undefined) {
        const options = mergeRecipient(quoteOptions, recipient);
        const bridgeQuote = await plan.bridge.driver.quoteReceiveAmount(
            plan.bridge.route,
            runningAmount,
            options,
        );
        legs.push(buildBridgeLeg(plan.bridge.route, bridgeQuote));
        runningAmount = bridgeQuote.amountOut;
    }

    return {
        from,
        to,
        sendAmount: amountIn,
        receiveAmount: runningAmount,
        legs,
    } as RouteQuote<A>;
};

export const quoteRouteAmountIn = async <A extends string = string>(
    args: RouteQuoteAmountInArgs<A>,
): Promise<RouteQuote<A>> => {
    const { from, to, pairs, amountOut, quoteOptions, recipient } = args;
    const plan = planLegs(from, to, pairs);

    let bridgeLeg: RouteBridgeLeg | undefined;
    let postBridgeRequiredIn = amountOut;
    if (plan.bridge !== undefined) {
        const options = mergeRecipient(quoteOptions, recipient);
        const bridgeAmountIn =
            await plan.bridge.driver.quoteAmountInForAmountOut(
                plan.bridge.route,
                amountOut,
                options,
            );
        const bridgeQuote = await plan.bridge.driver.quoteReceiveAmount(
            plan.bridge.route,
            bridgeAmountIn,
            options,
        );
        bridgeLeg = buildBridgeLeg(plan.bridge.route, bridgeQuote);
        postBridgeRequiredIn = bridgeAmountIn;
    }

    let dexLeg: RouteDexLeg | undefined;
    let postDexRequiredIn = postBridgeRequiredIn;
    if (plan.dex !== undefined) {
        const quotes = await quoteDexAmountOut(
            plan.dex.chain,
            plan.dex.tokenIn,
            plan.dex.tokenOut,
            postBridgeRequiredIn,
        );
        const best = pickFirstQuote(quotes, DexQuoteDirection.Out, from, to);
        const dexIn = BigInt(best.quote);
        dexLeg = {
            kind: RouteLegKind.Dex,
            chain: plan.dex.chain,
            tokenIn: plan.dex.tokenIn,
            tokenOut: plan.dex.tokenOut,
            amountIn: dexIn,
            amountOut: postBridgeRequiredIn,
            quote: best,
        };
        postDexRequiredIn = dexIn;
    }

    // postDexRequiredIn is in chain-swap-target base units; the chain-swap
    // fee math runs in sats.
    const chainSwapReceiveSats = toSats(postDexRequiredIn, plan.chainSwap.to);
    const chainSwapSend = applyChainPairSendAmount(
        chainSwapReceiveSats,
        plan.chainSwap.pair,
    );
    const chainLeg = buildChainSwapLeg(
        plan.chainSwap,
        chainSwapSend,
        postDexRequiredIn,
    );

    const legs: RouteLeg[] = [chainLeg];
    if (dexLeg !== undefined) {
        legs.push(dexLeg);
    }
    if (bridgeLeg !== undefined) {
        legs.push(bridgeLeg);
    }

    return {
        from,
        to,
        sendAmount: chainSwapSend,
        receiveAmount: amountOut,
        legs,
    } as RouteQuote<A>;
};

const mergeRecipient = (
    options: BridgeQuoteOptions | undefined,
    recipient: string | undefined,
): BridgeQuoteOptions | undefined => {
    if (recipient === undefined) {
        return options;
    }
    return { ...(options ?? {}), recipient };
};
