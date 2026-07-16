import { quoteDexAmountIn, quoteDexAmountOut } from "boltz-swaps/client";
import { AssetKind, NetworkTransport } from "boltz-swaps/types";
import log from "loglevel";
import { zeroAddress } from "viem";

import { config } from "../config";
import { getNetworkTransport } from "../consts/Assets";
import {
    formatAssetAmountForLog,
    formatNativeAmountForLog,
} from "./denomination";
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

const normalizeTokenAddress = (address: string) => {
    const trimmed = address.trim();
    return trimmed.startsWith("0x") ? trimmed.toLowerCase() : trimmed;
};

const getAssetForTokenAddress = (
    tokenAddress: string,
    chain: string,
): string | undefined => {
    const normalizedTokenAddress = normalizeTokenAddress(tokenAddress);
    const matches = Object.entries(config.assets ?? {}).filter(
        ([, assetConfig]) =>
            assetConfig.type === AssetKind.ERC20 &&
            assetConfig.token?.address !== undefined &&
            normalizeTokenAddress(assetConfig.token.address) ===
                normalizedTokenAddress,
    );

    const chainMatch = matches.find(
        ([, assetConfig]) => assetConfig.network?.symbol === chain,
    );

    return chainMatch?.[0] ?? matches[0]?.[0];
};

const formatTokenAmountForLog = (
    amount: bigint,
    tokenAddress: string,
    chain: string,
) =>
    formatAssetAmountForLog(
        amount,
        getAssetForTokenAddress(tokenAddress, chain) ?? tokenAddress,
    );

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
        minGasAmount:
            minGasAmount === undefined
                ? undefined
                : formatNativeAmountForLog(minGasAmount, asset),
        gasTokenPrice: gasTokenPrice.toString(),
        gasTokenAmount: formatNativeAmountForLog(gasTokenAmount, asset),
        gasTopUpAmount: formatNativeAmountForLog(gasTopUpAmount, asset),
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
    if (amountIn <= 0n) {
        throw new Error(
            `cannot fetch DEX quote with non-positive amount (${amountIn.toString()})`,
        );
    }

    if (getGasToken) {
        if (gasTokenAmount === undefined) {
            throw new Error("missing gas token amount");
        }

        const gasToken = await fetchGasTokenQuote(hop, gasTokenAmount);
        const tradeAmountIn = amountIn - gasToken.amountIn;

        log.info(
            `Spending ${formatTokenAmountForLog(
                gasToken.amountIn,
                hop.tokenIn,
                hop.chain,
            )} on gas`,
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
    const quotes = await (
        direction === Direction.In ? quoteDexAmountIn : quoteDexAmountOut
    )(hop.chain, hop.tokenIn, hop.tokenOut, amount);
    const quote = quotes[0];
    if (quote === undefined) {
        throw new Error(
            `no ${direction} DEX quote for ${hop.tokenIn} -> ${hop.tokenOut} ` +
                `on ${hop.chain} (amount ${amount.toString()})`,
        );
    }
    const quoteAmount = BigInt(quote.quote);
    const quoteToken = direction === Direction.In ? hop.tokenOut : hop.tokenIn;
    log.info(
        `Got ${direction} quote (${hop.tokenIn} -> ${hop.tokenOut}): ${formatTokenAmountForLog(
            quoteAmount,
            quoteToken,
            hop.chain,
        )}`,
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
            tokenOut: zeroAddress,
        },
        gasTokenAmount,
    );
};
