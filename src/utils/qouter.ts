import { ZeroAddress } from "ethers";
import log from "loglevel";

import { quoteDexAmountIn, quoteDexAmountOut } from "./boltzClient";
import { getEthPriceFailover, usdCentsToWei } from "./fiat";

const enum Direction {
    In = "in",
    Out = "out",
}

export const gasTokenToGetUsdCents = 10;

export type DexQuote = {
    amountIn: bigint;
    amountOut: bigint;
    data: unknown;
};

export type ClaimQuote = {
    trade: DexQuote;
    gasToken?: DexQuote;
};

type Hop = {
    chain: string;
    tokenIn: string;
    tokenOut: string;
};

export const fetchDexQuote = async (
    hop: Hop,
    amountIn: bigint,
    getGasToken?: boolean,
): Promise<ClaimQuote> => {
    if (getGasToken) {
        const gasToken = await fetchGasTokenQuote(hop);
        const tradeAmountIn = amountIn - gasToken.amountIn;

        log.info(
            `Spending ${gasToken.amountIn.toString()} ${hop.tokenIn} on gas`,
        );

        if (tradeAmountIn <= 0n) {
            throw new Error("amount too small to include gas");
        }

        const trade = await fetchQuote(Direction.In, hop, tradeAmountIn);
        return {
            trade,
            gasToken,
        };
    } else {
        return {
            trade: await fetchQuote(Direction.In, hop, amountIn),
        };
    }
};

const fetchQuote = async (
    direction: Direction,
    hop: Hop,
    amount: bigint,
): Promise<DexQuote> => {
    const quote = (
        await (
            direction === Direction.In ? quoteDexAmountIn : quoteDexAmountOut
        )(hop.chain, hop.tokenIn, hop.tokenOut, amount)
    )[0];
    const quoteAmount = BigInt(quote.quote);
    log.info(
        `Got ${direction} quote (${hop.tokenIn} -> ${hop.tokenOut}): ${quoteAmount.toString()}`,
        quote.data,
    );
    return {
        amountIn: direction === Direction.In ? amount : quoteAmount,
        amountOut: direction === Direction.Out ? amount : quoteAmount,
        data: quote.data,
    };
};

export const fetchGasTokenQuote = async (hop: Hop): Promise<DexQuote> => {
    const ethPrice = await getEthPriceFailover();
    const gasTokenAmount = usdCentsToWei(gasTokenToGetUsdCents, ethPrice);

    return await fetchQuote(
        Direction.Out,
        {
            chain: hop.chain,
            tokenIn: hop.tokenIn,
            tokenOut: ZeroAddress,
        },
        gasTokenAmount,
    );
};
