import { ZeroAddress } from "ethers";

import { quoteDexAmountIn, quoteDexAmountOut } from "./client";
import { getConfig } from "./config";
import { AssetKind } from "./enums";
import {
    getGasTokenPriceFailover,
    hasGasTokenPriceLookup,
    usdCentsToWei,
} from "./fiatGas";

const enum Direction {
    In = "in",
    Out = "out",
}

export const gasTokenToGetUsdCents = 10;

export const getGasTopUpToken = (asset: string): string | undefined =>
    getConfig().assets?.[asset]?.network?.gasToken;

const gasDropsDisabled = (gasToken: string | undefined) =>
    gasToken === "USDT0";

/** Whether DEX gas-top-up is supported for the destination asset (matches web app rules). */
export const gasTopUpSupported = (asset: string): boolean =>
    getConfig().assets?.[asset]?.type === AssetKind.ERC20 &&
    !gasDropsDisabled(getGasTopUpToken(asset)) &&
    hasGasTokenPriceLookup(getGasTopUpToken(asset) ?? "");

export const getGasTopUpNativeAmount = async (
    asset: string,
): Promise<bigint> => {
    const gasToken = getGasTopUpToken(asset);
    if (gasToken === undefined) {
        throw new Error(`missing gas token for top-up asset ${asset}`);
    }
    if (gasDropsDisabled(gasToken)) {
        throw new Error(`gas drops are disabled for gas token ${gasToken}`);
    }
    const gasTokenPrice = await getGasTokenPriceFailover(gasToken);
    return usdCentsToWei(gasTokenToGetUsdCents, gasTokenPrice);
};

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
    gasTokenAmount?: bigint,
): Promise<ClaimQuote> => {
    if (getGasToken) {
        if (gasTokenAmount === undefined) {
            throw new Error("missing gas token amount");
        }
        const gasToken = await fetchGasTokenQuote(hop, gasTokenAmount);
        const tradeAmountIn = amountIn - gasToken.amountIn;
        if (tradeAmountIn <= 0n) {
            throw new Error("amount too small to include gas");
        }
        const trade = await fetchQuote(Direction.In, hop, tradeAmountIn);
        return { trade, gasToken };
    }
    return { trade: await fetchQuote(Direction.In, hop, amountIn) };
};

const fetchQuote = async (
    direction: Direction,
    hop: Hop,
    amount: bigint,
): Promise<DexQuote> => {
    const quote = (
        await (direction === Direction.In ? quoteDexAmountIn : quoteDexAmountOut)(
            hop.chain,
            hop.tokenIn,
            hop.tokenOut,
            amount,
        )
    )[0];
    const quoteAmount = BigInt(quote.quote);
    return {
        amountIn: direction === Direction.In ? amount : quoteAmount,
        amountOut: direction === Direction.Out ? amount : quoteAmount,
        data: quote.data,
    };
};

export const fetchGasTokenQuote = async (
    hop: Hop,
    gasTokenAmount: bigint,
): Promise<DexQuote> => {
    if (gasTokenAmount <= 0n) {
        throw new Error("gas token amount must be positive");
    }
    return fetchQuote(
        Direction.Out,
        {
            chain: hop.chain,
            tokenIn: hop.tokenIn,
            tokenOut: ZeroAddress,
        },
        gasTokenAmount,
    );
};
