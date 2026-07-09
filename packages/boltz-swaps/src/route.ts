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
    RouteChainSwapLeg<A> | RouteDexLeg | RouteBridgeLeg<A>;

export type RouteQuote<A extends string = string> = {
    from: A;
    to: A;
    sendAmount: bigint;
    receiveAmount: bigint;
    legs: RouteLeg<A>[];
};

export type RoutePlan<A extends string = string> = {
    from: A;
    to: A;
    chainSwap: { from: A; to: A };
    dex?: { chain: string; tokenIn: string; tokenOut: string };
    bridge?: { sourceAsset: A; destinationAsset: A };
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

type ChainSwapStep = {
    kind: RouteLegKind.ChainSwap;
    from: string;
    to: string;
    pair: ChainPairTypeTaproot;
};

type DexStep = {
    kind: RouteLegKind.Dex;
    chain: string;
    tokenIn: string;
    tokenOut: string;
};

type BridgeStep = {
    kind: RouteLegKind.Bridge;
    route: BridgeRoute;
    driver: BridgeDriver;
};

type PlanStep = ChainSwapStep | DexStep | BridgeStep;

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

const resolveBridgeStep = (
    to: string,
): { landingAsset: string; bridge?: BridgeStep } => {
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
            kind: RouteLegKind.Bridge,
            route,
            driver: bridgeRegistry.requireDriverForRoute(route),
        },
    };
};

const planLegs = (from: string, to: string, pairs: Pairs): PlanStep[] => {
    const { landingAsset, bridge } = resolveBridgeStep(to);

    const direct = pairs[SwapType.Chain]?.[from]?.[landingAsset];
    if (direct !== undefined) {
        const steps: PlanStep[] = [
            {
                kind: RouteLegKind.ChainSwap,
                from,
                to: landingAsset,
                pair: direct,
            },
        ];
        if (bridge !== undefined) {
            steps.push(bridge);
        }
        return steps;
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

    const steps: PlanStep[] = [
        {
            kind: RouteLegKind.ChainSwap,
            from,
            to: viaAsset,
            pair: viaPair,
        },
        {
            kind: RouteLegKind.Dex,
            chain: viaConfig.network.symbol,
            tokenIn: viaConfig.token.address,
            tokenOut: landingConfig.token.address,
        },
    ];
    if (bridge !== undefined) {
        steps.push(bridge);
    }
    return steps;
};

export const planRoute = <A extends string = string>(
    from: A,
    to: A,
    pairs: Pairs,
): RoutePlan<A> => {
    const steps = planLegs(from, to, pairs);
    const chainSwapStep = steps.find(
        (step): step is ChainSwapStep => step.kind === RouteLegKind.ChainSwap,
    );
    if (chainSwapStep === undefined) {
        throw new RouteUnavailableError("no chain-swap leg planned", from, to);
    }
    const dexStep = steps.find(
        (step): step is DexStep => step.kind === RouteLegKind.Dex,
    );
    const bridgeStep = steps.find(
        (step): step is BridgeStep => step.kind === RouteLegKind.Bridge,
    );

    return {
        from,
        to,
        chainSwap: {
            from: chainSwapStep.from as A,
            to: chainSwapStep.to as A,
        },
        dex:
            dexStep !== undefined
                ? {
                      chain: dexStep.chain,
                      tokenIn: dexStep.tokenIn,
                      tokenOut: dexStep.tokenOut,
                  }
                : undefined,
        bridge:
            bridgeStep !== undefined
                ? {
                      sourceAsset: bridgeStep.route.sourceAsset as A,
                      destinationAsset: bridgeStep.route.destinationAsset as A,
                  }
                : undefined,
    };
};

const buildChainSwapLeg = (
    step: ChainSwapStep,
    sendAmount: bigint,
    receiveAmount: bigint,
): RouteChainSwapLeg => ({
    kind: RouteLegKind.ChainSwap,
    from: step.from,
    to: step.to,
    sendAmount,
    receiveAmount,
    fees: {
        percentage: step.pair.fees.percentage,
        minerFees: {
            server: step.pair.fees.minerFees.server,
            userLockup: step.pair.fees.minerFees.user.lockup,
            userClaim: step.pair.fees.minerFees.user.claim,
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

type StepCtx = {
    from: string;
    to: string;
    options: BridgeQuoteOptions | undefined;
};

const executeStepForward = async (
    step: PlanStep,
    amountIn: bigint,
    ctx: StepCtx,
): Promise<{ leg: RouteLeg; amountOut: bigint }> => {
    switch (step.kind) {
        case RouteLegKind.ChainSwap: {
            const sendSats = toSats(amountIn, step.from);
            const outSats = applyChainPairReceiveAmount(sendSats, step.pair);
            const amountOut = toAssetBaseUnits(outSats, step.to);
            return {
                leg: buildChainSwapLeg(step, amountIn, amountOut),
                amountOut,
            };
        }

        case RouteLegKind.Dex: {
            const quotes = await quoteDexAmountIn(
                step.chain,
                step.tokenIn,
                step.tokenOut,
                amountIn,
            );
            const best = pickFirstQuote(
                quotes,
                DexQuoteDirection.In,
                ctx.from,
                ctx.to,
            );
            const amountOut = BigInt(best.quote);
            return {
                leg: {
                    kind: RouteLegKind.Dex,
                    chain: step.chain,
                    tokenIn: step.tokenIn,
                    tokenOut: step.tokenOut,
                    amountIn,
                    amountOut,
                    quote: best,
                },
                amountOut,
            };
        }

        case RouteLegKind.Bridge: {
            const quote = await step.driver.quoteReceiveAmount(
                step.route,
                amountIn,
                ctx.options,
            );
            return {
                leg: buildBridgeLeg(step.route, quote),
                amountOut: quote.amountOut,
            };
        }
    }
};

const executeStepReverse = async (
    step: PlanStep,
    amountOut: bigint,
    ctx: StepCtx,
): Promise<{ leg: RouteLeg; amountIn: bigint }> => {
    switch (step.kind) {
        case RouteLegKind.ChainSwap: {
            // amountOut is in chain-swap-target base units; fee math runs in sats.
            const receiveSats = toSats(amountOut, step.to);
            const sendSats = applyChainPairSendAmount(receiveSats, step.pair);
            const amountIn = toAssetBaseUnits(sendSats, step.from);
            return {
                leg: buildChainSwapLeg(step, amountIn, amountOut),
                amountIn,
            };
        }
        case RouteLegKind.Dex: {
            const quotes = await quoteDexAmountOut(
                step.chain,
                step.tokenIn,
                step.tokenOut,
                amountOut,
            );
            const best = pickFirstQuote(
                quotes,
                DexQuoteDirection.Out,
                ctx.from,
                ctx.to,
            );
            const amountIn = BigInt(best.quote);
            return {
                leg: {
                    kind: RouteLegKind.Dex,
                    chain: step.chain,
                    tokenIn: step.tokenIn,
                    tokenOut: step.tokenOut,
                    amountIn,
                    amountOut,
                    quote: best,
                },
                amountIn,
            };
        }
        case RouteLegKind.Bridge: {
            const amountIn = await step.driver.quoteAmountInForAmountOut(
                step.route,
                amountOut,
                ctx.options,
            );
            const quote = await step.driver.quoteReceiveAmount(
                step.route,
                amountIn,
                ctx.options,
            );
            return { leg: buildBridgeLeg(step.route, quote), amountIn };
        }
    }
};

export const quoteRouteAmountOut = async <A extends string = string>(
    args: RouteQuoteAmountOutArgs<A>,
): Promise<RouteQuote<A>> => {
    const { from, to, pairs, amountIn, quoteOptions, recipient } = args;
    const steps = planLegs(from, to, pairs);
    const ctx: StepCtx = {
        from,
        to,
        options: mergeRecipient(quoteOptions, recipient),
    };

    const legs: RouteLeg[] = [];
    let amount = amountIn;
    for (const step of steps) {
        const result = await executeStepForward(step, amount, ctx);
        legs.push(result.leg);
        amount = result.amountOut;
    }

    return {
        from,
        to,
        sendAmount: amountIn,
        receiveAmount: amount,
        legs,
    } as RouteQuote<A>;
};

export const quoteRouteAmountIn = async <A extends string = string>(
    args: RouteQuoteAmountInArgs<A>,
): Promise<RouteQuote<A>> => {
    const { from, to, pairs, amountOut, quoteOptions, recipient } = args;
    const steps = planLegs(from, to, pairs);
    const ctx: StepCtx = {
        from,
        to,
        options: mergeRecipient(quoteOptions, recipient),
    };

    const legs: RouteLeg[] = new Array(steps.length);
    let required = amountOut;
    for (let i = steps.length - 1; i >= 0; i--) {
        const result = await executeStepReverse(steps[i], required, ctx);
        legs[i] = result.leg;
        required = result.amountIn;
    }

    return {
        from,
        to,
        sendAmount: required,
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
