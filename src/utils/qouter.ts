import { ZeroAddress } from "ethers";
import log from "loglevel";
import { NetworkTransport } from "src/configs/base";

import { config } from "../config";
import { AssetKind, getNetworkTransport } from "../consts/Assets";
import { quoteDexAmountIn, quoteDexAmountOut } from "./boltzClient";
import {
    getGasTokenPriceFailover,
    hasGasTokenPriceLookup,
    usdCentsToBaseUnits,
} from "./fiat";

const enum Direction {
    In = "in",
    Out = "out",
}

export const gasTokenToGetUsdCents = 10;

export const getGasTopUpToken = (asset: string): string | undefined =>
    config.assets?.[asset]?.network?.gasToken;

const gasDropsDisabled = (gasToken: string | undefined) => gasToken === "USDT0";

export const gasTopUpSupported = (asset: string) => {
    const transport = getNetworkTransport(asset);
    return (
        (transport === NetworkTransport.Solana ||
            transport === NetworkTransport.Evm) &&
        config.assets?.[asset]?.type === AssetKind.ERC20 &&
        !gasDropsDisabled(getGasTopUpToken(asset)) &&
        hasGasTokenPriceLookup(getGasTopUpToken(asset) ?? "")
    );
};

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

    const nativeCurrency = config.assets?.[asset]?.network?.nativeCurrency;
    const nativeDecimals = nativeCurrency?.decimals;
    const minGasAmount = nativeCurrency?.minGas;
    if (
        nativeDecimals === undefined ||
        !Number.isInteger(nativeDecimals) ||
        nativeDecimals < 0
    ) {
        throw new Error(`missing native decimals for top-up asset ${asset}`);
    }

    const gasTokenPrice = await getGasTokenPriceFailover(gasToken);
    const gasTokenAmount = usdCentsToBaseUnits(
        gasTokenToGetUsdCents,
        gasTokenPrice,
        nativeDecimals,
    );
    const gasTopUpAmount =
        minGasAmount !== undefined && minGasAmount > gasTokenAmount
            ? minGasAmount
            : gasTokenAmount;
    log.info("Calculated gas top-up native amount", {
        asset,
        gasToken,
        nativeDecimals,
        minGasAmount: minGasAmount?.toString(),
        gasTokenPrice: gasTokenPrice.toString(),
        gasTokenAmount: gasTokenAmount.toString(),
        gasTopUpAmount: gasTopUpAmount.toString(),
        usdCents: gasTokenToGetUsdCents,
    });
    return gasTopUpAmount;
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

export const fetchGasTokenQuote = async (
    hop: Hop,
    gasTokenAmount: bigint,
): Promise<DexQuote> => {
    if (gasTokenAmount <= 0n) {
        throw new Error("gas token amount must be positive");
    }

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
