import BigNumber from "bignumber.js";
import log from "loglevel";

import { config } from "../config";
import { BTC } from "../consts/Assets";
import { Currency } from "../consts/Enums";
import { satToBtc } from "./denomination";
import { formatError } from "./errors";
import { constructRequestOptions } from "./helper";

const requestTimeoutDuration = 6_000;
const weiPerEther = BigNumber(10).pow(18);

type KrakenTickerResponse = {
    result: Record<
        string,
        {
            c: [string, string];
        }
    >;
};

type CoinGeckoPriceResponse = {
    ethereum?: Record<string, number>;
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

export const getEthPriceCoinGecko = async (currency: Currency) => {
    const { opts, requestTimeout } = constructRequestOptions(
        {},
        requestTimeoutDuration,
    );
    try {
        const response = await fetch(
            `${config.rateProviders.CoinGecko}?ids=ethereum&vs_currencies=${currency.toLowerCase()}`,
            opts,
        );
        const data = (await response.json()) as CoinGeckoPriceResponse;
        const price = data.ethereum?.[currency.toLowerCase()];

        if (price === undefined) {
            throw new Error(`missing CoinGecko price for ETH/${currency}`);
        }

        return BigNumber(price);
    } catch (e) {
        throw new Error(
            `failed to get ETH price from CoinGecko in ${currency}: ${formatError(
                e,
            )}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }
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

export const convertToFiat = (amount: BigNumber, rate: BigNumber) => {
    if (amount.isNaN() || rate.isNaN()) {
        return BigNumber(0);
    }

    const btcAmount = satToBtc(amount);
    return btcAmount.multipliedBy(BigNumber(rate));
};

export const usdCentsToWei = (
    usdCents: BigNumber.Value,
    ethUsdPrice: BigNumber,
): bigint => {
    const cents = BigNumber(usdCents);

    if (
        cents.isNaN() ||
        ethUsdPrice.isNaN() ||
        cents.lte(0) ||
        ethUsdPrice.lte(0)
    ) {
        return 0n;
    }

    return BigInt(
        cents
            .multipliedBy(weiPerEther)
            .dividedBy(100)
            .dividedBy(ethUsdPrice)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0),
    );
};
