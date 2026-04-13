import BigNumber from "bignumber.js";
import log from "loglevel";

import { config } from "../config";
import { isTor } from "../configs/base";
import { BTC } from "../consts/Assets";
import { Currency } from "../consts/Enums";
import { satToBtc } from "./denomination";
import { formatError } from "./errors";
import { constructRequestOptions } from "./helper";

const requestTimeoutDuration = isTor() ? 25_000 : 6_000;

type KrakenTickerResponse = {
    result: Record<
        string,
        {
            c: [string, string];
        }
    >;
};

type CoinGeckoPriceResponse = Record<string, Record<string, number>>;

type PriceLookupConfig = {
    krakenPair?: string;
    coinGeckoId?: string;
};

const gasTokenPriceLookups: Record<string, PriceLookupConfig> = {
    ETH: {
        krakenPair: "XETHZUSD",
        coinGeckoId: "ethereum",
    },
    BERA: {
        coinGeckoId: "berachain",
    },
    CFX: {
        coinGeckoId: "conflux",
    },
    HBAR: {
        coinGeckoId: "hedera-hashgraph",
    },
    HYPE: {
        coinGeckoId: "hyperliquid",
    },
    MNT: {
        coinGeckoId: "mantle",
    },
    MON: {
        coinGeckoId: "monad",
    },
    OKB: {
        coinGeckoId: "okb",
    },
    POL: {
        coinGeckoId: "polygon-ecosystem-token",
    },
    SEI: {
        coinGeckoId: "sei",
    },
    SOL: {
        coinGeckoId: "solana",
    },
    SGB: {
        coinGeckoId: "songbird",
    },
    USDT0: {
        coinGeckoId: "usdt0",
    },
    XPL: {
        coinGeckoId: "plasma",
    },
};

const getKrakenPrice = async (
    asset: string,
    pair: string,
    currency: Currency,
) => {
    const { opts, requestTimeout } = constructRequestOptions(
        {},
        requestTimeoutDuration,
    );
    try {
        const response = await fetch(
            `${config.rateProviders.Kraken}?pair=${pair}`,
            opts,
        );
        const data = (await response.json()) as KrakenTickerResponse;
        const ticker = data.result[pair];

        if (!ticker) {
            throw new Error(`missing Kraken ticker for pair ${pair}`);
        }

        return BigNumber(ticker.c[0]);
    } catch (e) {
        throw new Error(
            `failed to get ${asset} price from Kraken in ${currency}: ${formatError(
                e,
            )}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getBtcPriceYadio = async (currency: Currency) => {
    const { opts, requestTimeout } = constructRequestOptions(
        {},
        requestTimeoutDuration,
    );
    try {
        const response = await fetch(config.rateProviders.Yadio, opts);

        const data = (await response.json()) as {
            BTC: Record<string, number>;
        };

        return BigNumber(data[BTC][currency]);
    } catch (e) {
        throw new Error(
            `failed to get BTC price from Yadio: ${formatError(e)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getBtcPriceKraken = (currency: Currency) => {
    return getKrakenPrice("BTC", `XXBTZ${currency}`, currency);
};

export const getEthPriceKraken = (currency: Currency) => {
    return getKrakenPrice("ETH", `XETHZ${currency}`, currency);
};

const getCoinGeckoPrice = async (
    asset: string,
    coinGeckoId: string,
    currency: Currency,
) => {
    const { opts, requestTimeout } = constructRequestOptions(
        {},
        requestTimeoutDuration,
    );
    try {
        const response = await fetch(
            `${config.rateProviders.CoinGecko}?ids=${coinGeckoId}&vs_currencies=${currency.toLowerCase()}`,
            opts,
        );
        const data = (await response.json()) as CoinGeckoPriceResponse;
        const price = data[coinGeckoId]?.[currency.toLowerCase()];

        if (price === undefined) {
            throw new Error(`missing CoinGecko price for ${asset}/${currency}`);
        }

        return BigNumber(price);
    } catch (e) {
        throw new Error(
            `failed to get ${asset} price from CoinGecko in ${currency}: ${formatError(
                e,
            )}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getEthPriceCoinGecko = async (currency: Currency) => {
    return await getCoinGeckoPrice("ETH", "ethereum", currency);
};

const getGasTokenPriceLookup = (
    symbol: string,
): PriceLookupConfig | undefined => {
    return gasTokenPriceLookups[symbol.toUpperCase()];
};

export const hasGasTokenPriceLookup = (symbol: string): boolean => {
    if (symbol.toUpperCase() === "RBTC") {
        return true;
    }

    const lookup = getGasTokenPriceLookup(symbol);
    return (
        lookup?.krakenPair !== undefined || lookup?.coinGeckoId !== undefined
    );
};

export const getGasTokenPriceKraken = (symbol: string, currency: Currency) => {
    const lookup = getGasTokenPriceLookup(symbol);
    const pair = lookup?.krakenPair;

    if (pair === undefined) {
        throw new Error(`missing Kraken price lookup for gas token ${symbol}`);
    }

    return getKrakenPrice(symbol, pair, currency);
};

export const getGasTokenPriceCoinGecko = async (
    symbol: string,
    currency: Currency,
) => {
    const lookup = getGasTokenPriceLookup(symbol);
    const coinGeckoId = lookup?.coinGeckoId;

    if (coinGeckoId === undefined) {
        throw new Error(
            `missing CoinGecko price lookup for gas token ${symbol}`,
        );
    }

    return await getCoinGeckoPrice(symbol, coinGeckoId, currency);
};

export const getBtcPriceMempool = async (currency: Currency) => {
    const { opts, requestTimeout } = constructRequestOptions(
        {},
        requestTimeoutDuration,
    );
    try {
        const response = await fetch(config.rateProviders.Mempool, opts);
        const data = (await response.json()) as { [currency: string]: number };
        return BigNumber(data[currency]);
    } catch (e) {
        throw new Error(
            `failed to get BTC price from Mempool: ${formatError(e)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getBtcPriceFailover = async (
    currency: Currency = Currency.USD,
) => {
    for (const [name, getBtcPrice] of [
        ["Mempool", getBtcPriceMempool],
        ["Kraken", getBtcPriceKraken],
        ["Yadio", getBtcPriceYadio],
    ] as [string, typeof getBtcPriceMempool][]) {
        try {
            return await getBtcPrice(currency);
        } catch (e) {
            log.warn(`Failed to get BTC price from provider ${name}`, e);
            continue;
        }
    }
    throw new Error("all attempts of getting BTC price failed");
};

export const getEthPriceFailover = async (
    currency: Currency = Currency.USD,
) => {
    for (const [name, getEthPrice] of [
        ["Kraken", getEthPriceKraken],
        ["CoinGecko", getEthPriceCoinGecko],
    ] as [string, typeof getEthPriceKraken][]) {
        try {
            return await getEthPrice(currency);
        } catch (e) {
            log.warn(`Failed to get ETH price from provider ${name}`, e);
            continue;
        }
    }
    throw new Error("all attempts of getting ETH price failed");
};

export const getGasTokenPriceFailover = async (
    symbol: string,
    currency: Currency = Currency.USD,
) => {
    if (symbol.toUpperCase() === "RBTC") {
        return await getBtcPriceFailover(currency);
    }

    const lookup = getGasTokenPriceLookup(symbol);
    const providers = [
        lookup?.krakenPair === undefined
            ? undefined
            : [
                  "Kraken",
                  (requestedCurrency: Currency) =>
                      getGasTokenPriceKraken(symbol, requestedCurrency),
              ],
        lookup?.coinGeckoId === undefined
            ? undefined
            : [
                  "CoinGecko",
                  (requestedCurrency: Currency) =>
                      getGasTokenPriceCoinGecko(symbol, requestedCurrency),
              ],
    ].filter((provider) => provider !== undefined) as [
        string,
        (currency: Currency) => Promise<BigNumber>,
    ][];

    if (providers.length === 0) {
        throw new Error(`all attempts of getting ${symbol} price failed`);
    }

    for (const [name, getPrice] of providers) {
        try {
            return await getPrice(currency);
        } catch (e) {
            log.warn(`Failed to get ${symbol} price from provider ${name}`, e);
            continue;
        }
    }

    throw new Error(`all attempts of getting ${symbol} price failed`);
};

export const convertToFiat = (amount: BigNumber, rate: BigNumber) => {
    if (amount.isNaN() || rate.isNaN()) {
        return BigNumber(0);
    }

    const btcAmount = satToBtc(amount);
    return btcAmount.multipliedBy(BigNumber(rate));
};

export const usdCentsToBaseUnits = (
    usdCents: BigNumber.Value,
    assetUsdPrice: BigNumber,
    decimals: number,
): bigint => {
    const cents = BigNumber(usdCents);
    const baseUnits = BigNumber(10).pow(decimals);

    if (
        cents.isNaN() ||
        assetUsdPrice.isNaN() ||
        !Number.isInteger(decimals) ||
        decimals < 0 ||
        cents.lte(0) ||
        assetUsdPrice.lte(0)
    ) {
        return 0n;
    }

    return BigInt(
        cents
            .multipliedBy(baseUnits)
            .dividedBy(100)
            .dividedBy(assetUsdPrice)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0),
    );
};

export const usdCentsToWei = (
    usdCents: BigNumber.Value,
    ethUsdPrice: BigNumber,
): bigint => usdCentsToBaseUnits(usdCents, ethUsdPrice, 18);
