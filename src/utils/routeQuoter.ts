import BigNumber from "bignumber.js";
import {
    type BridgeQuoteOptions,
    type RouteLeg,
    type RouteQuote,
    quoteRouteAmountIn as libQuoteRouteAmountIn,
    quoteRouteAmountOut as libQuoteRouteAmountOut,
} from "boltz-swaps";
import { type Pairs } from "boltz-swaps/client";

export type HostRouteQuote<A extends string = string> = {
    sendAmount: BigNumber;
    receiveAmount: BigNumber;
    legs: RouteLeg<A>[];
    raw: RouteQuote<A>;
};

type HostRouteArgs<A extends string> = {
    from: A;
    to: A;
    pairs: Pairs;
    quoteOptions?: BridgeQuoteOptions;
    recipient?: string;
};

const toBigInt = (amount: BigNumber): bigint =>
    BigInt(amount.integerValue(BigNumber.ROUND_FLOOR).toFixed(0));

const wrap = <A extends string>(raw: RouteQuote<A>): HostRouteQuote<A> => ({
    sendAmount: BigNumber(raw.sendAmount.toString()),
    receiveAmount: BigNumber(raw.receiveAmount.toString()),
    legs: raw.legs,
    raw,
});

export const quoteRouteAmountOut = async <A extends string = string>(
    args: HostRouteArgs<A> & { sendAmount: BigNumber },
): Promise<HostRouteQuote<A>> => {
    const { sendAmount, ...rest } = args;
    const raw = await libQuoteRouteAmountOut<A>({
        ...rest,
        amountIn: toBigInt(sendAmount),
    });
    return wrap(raw);
};

export const quoteRouteAmountIn = async <A extends string = string>(
    args: HostRouteArgs<A> & { receiveAmount: BigNumber },
): Promise<HostRouteQuote<A>> => {
    const { receiveAmount, ...rest } = args;
    const raw = await libQuoteRouteAmountIn<A>({
        ...rest,
        amountOut: toBigInt(receiveAmount),
    });
    return wrap(raw);
};
