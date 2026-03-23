import { BigNumber } from "bignumber.js";

import { withFetchTimeout } from "../internal/fetchOptions";
import { BTC } from "./assets";
import { getConfig } from "./config";
import { Currency } from "./enums";
import { satToBtc } from "./denomination";
import { formatError } from "./errors";

const weiPerEther = BigNumber(10).pow(18);

const defaultRateProviders = {
    Yadio: "https://api.yadio.io/exrates/btc",
    Kraken: "https://api.kraken.com/0/public/Ticker",
    Mempool: "https://mempool.space/api/v1/prices",
    CoinGecko: "https://api.coingecko.com/api/v3/simple/price",
} as const;

const getRateUrls = () => ({
    ...defaultRateProviders,
    ...getConfig().rateProviders,
});

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
    ETH: { krakenPair: "XETHZUSD", coinGeckoId: "ethereum" },
    BERA: { coinGeckoId: "berachain" },
    CFX: { coinGeckoId: "conflux" },
    HBAR: { coinGeckoId: "hedera-hashgraph" },
    HYPE: { coinGeckoId: "hyperliquid" },
    MNT: { coinGeckoId: "mantle" },
    MON: { coinGeckoId: "monad" },
    OKB: { coinGeckoId: "okb" },
    POL: { coinGeckoId: "polygon-ecosystem-token" },
    SEI: { coinGeckoId: "sei" },
    SGB: { coinGeckoId: "songbird" },
    USDT0: { coinGeckoId: "usdt0" },
    XPL: { coinGeckoId: "plasma" },
};

const getKrakenPrice = async (
    asset: string,
    pair: string,
    currency: Currency,
): Promise<BigNumber> => {
    const { opts, requestTimeout } = withFetchTimeout();
    try {
        const response = await fetch(
            `${getRateUrls().Kraken}?pair=${pair}`,
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
            `failed to get ${asset} price from Kraken in ${currency}: ${formatError(e)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getBtcPriceYadio = async (currency: Currency): Promise<BigNumber> => {
    const { opts, requestTimeout } = withFetchTimeout();
    try {
        const response = await fetch(getRateUrls().Yadio, opts);
        const data = (await response.json()) as { BTC: Record<string, number> };
        return BigNumber(data[BTC][currency]);
    } catch (e) {
        throw new Error(
            `failed to get BTC price from Yadio: ${formatError(e)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getCoinGeckoPrice = async (
    asset: string,
    coinGeckoId: string,
    currency: Currency,
): Promise<BigNumber> => {
    const { opts, requestTimeout } = withFetchTimeout();
    try {
        const response = await fetch(
            `${getRateUrls().CoinGecko}?ids=${coinGeckoId}&vs_currencies=${currency.toLowerCase()}`,
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
            `failed to get ${asset} price from CoinGecko in ${currency}: ${formatError(e)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getEthPriceKraken = (currency: Currency) =>
    getKrakenPrice("ETH", `XETHZ${currency}`, currency);

const getEthPriceCoinGecko = async (currency: Currency) =>
    getCoinGeckoPrice("ETH", "ethereum", currency);

const getGasTokenPriceLookup = (
    symbol: string,
): PriceLookupConfig | undefined =>
    gasTokenPriceLookups[symbol.toUpperCase()];

/** Whether a gas-token symbol has a configured Kraken/CoinGecko lookup. */
export const hasGasTokenPriceLookup = (symbol: string): boolean => {
    if (symbol.toUpperCase() === "RBTC") {
        return true;
    }
    const lookup = getGasTokenPriceLookup(symbol);
    return (
        lookup?.krakenPair !== undefined || lookup?.coinGeckoId !== undefined
    );
};

const getGasTokenPriceKraken = (symbol: string, currency: Currency) => {
    const lookup = getGasTokenPriceLookup(symbol);
    const pair = lookup?.krakenPair;
    if (pair === undefined) {
        throw new Error(`missing Kraken price lookup for gas token ${symbol}`);
    }
    return getKrakenPrice(symbol, pair, currency);
};

const getGasTokenPriceCoinGecko = async (
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
    return getCoinGeckoPrice(symbol, coinGeckoId, currency);
};

const getBtcPriceMempool = async (currency: Currency): Promise<BigNumber> => {
    const { opts, requestTimeout } = withFetchTimeout();
    try {
        const response = await fetch(getRateUrls().Mempool, opts);
        const data = (await response.json()) as { [key: string]: number };
        return BigNumber(data[currency]);
    } catch (e) {
        throw new Error(
            `failed to get BTC price from Mempool: ${formatError(e)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getBtcPriceKraken = (currency: Currency) =>
    getKrakenPrice("BTC", `XXBTZ${currency}`, currency);

const getBtcPriceFailover = async (
    currency: Currency = Currency.USD,
): Promise<BigNumber> => {
    for (const getBtcPrice of [
        getBtcPriceMempool,
        getBtcPriceKraken,
        getBtcPriceYadio,
    ] as ((c: Currency) => Promise<BigNumber>)[]) {
        try {
            return await getBtcPrice(currency);
        } catch {
            continue;
        }
    }
    throw new Error("all attempts of getting BTC price failed");
};

const getEthPriceFailover = async (
    currency: Currency = Currency.USD,
): Promise<BigNumber> => {
    for (const getEthPrice of [
        getEthPriceKraken,
        getEthPriceCoinGecko,
    ] as ((c: Currency) => Promise<BigNumber>)[]) {
        try {
            return await getEthPrice(currency);
        } catch {
            continue;
        }
    }
    throw new Error("all attempts of getting ETH price failed");
};

/**
 * Best-effort USD price for a chain's native gas token (used for gas top-up).
 */
export const getGasTokenPriceFailover = async (
    symbol: string,
    currency: Currency = Currency.USD,
): Promise<BigNumber> => {
    if (symbol.toUpperCase() === "RBTC") {
        return getBtcPriceFailover(currency);
    }

    const lookup = getGasTokenPriceLookup(symbol);
    const providers = [
        lookup?.krakenPair === undefined
            ? undefined
            : (requestedCurrency: Currency) =>
                  getGasTokenPriceKraken(symbol, requestedCurrency),
        lookup?.coinGeckoId === undefined
            ? undefined
            : (requestedCurrency: Currency) =>
                  getGasTokenPriceCoinGecko(symbol, requestedCurrency),
    ].filter((p) => p !== undefined) as (
        (currency: Currency) => Promise<BigNumber>
    )[];

    if (providers.length === 0) {
        throw new Error(`all attempts of getting ${symbol} price failed`);
    }

    for (const getPrice of providers) {
        try {
            return await getPrice(currency);
        } catch {
            continue;
        }
    }

    throw new Error(`all attempts of getting ${symbol} price failed`);
};

/** Convert USD cents to wei of the gas token using its USD price. */
export const usdCentsToWei = (
    usdCents: BigNumber.Value,
    tokenUsdPrice: BigNumber,
): bigint => {
    const cents = BigNumber(usdCents);
    if (
        cents.isNaN() ||
        tokenUsdPrice.isNaN() ||
        cents.lte(0) ||
        tokenUsdPrice.lte(0)
    ) {
        return 0n;
    }
    return BigInt(
        cents
            .multipliedBy(weiPerEther)
            .dividedBy(100)
            .dividedBy(tokenUsdPrice)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0),
    );
};

/** @internal Used by tests / advanced integrations. */
export const convertToFiat = (amount: BigNumber, rate: BigNumber): BigNumber => {
    if (amount.isNaN() || rate.isNaN()) {
        return BigNumber(0);
    }
    const btcAmount = satToBtc(amount);
    return btcAmount.multipliedBy(rate);
};
