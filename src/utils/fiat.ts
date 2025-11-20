import BigNumber from "bignumber.js";
import log from "loglevel";

import { config } from "../config";
import { BTC } from "../consts/Assets";
import { Currency } from "../consts/Enums";
import { satToBtc } from "./denomination";
import { formatError } from "./errors";
import { constructRequestOptions } from "./helper";

const requestTimeoutDuration = 6_000;

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

export const getBtcPriceKraken = async (currency: Currency) => {
    type KrakenResponse = {
        result: {
            XXBTZUSD: {
                c: [string, string];
            };
        };
    };

    const { opts, requestTimeout } = constructRequestOptions(
        {},
        requestTimeoutDuration,
    );
    try {
        const response = await fetch(
            `${config.rateProviders.Kraken}?pair=XXBTZ${currency}`,
            opts,
        );
        const data = (await response.json()) as KrakenResponse;
        return BigNumber(data.result.XXBTZUSD.c[0]);
    } catch (e) {
        throw new Error(
            `failed to get BTC price from Kraken: ${formatError(e)}`,
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

export const convertToFiat = (amount: BigNumber, rate: BigNumber) => {
    if (amount.isNaN() || rate.isNaN()) {
        return BigNumber(0);
    }

    const btcAmount = satToBtc(amount);
    return btcAmount.multipliedBy(BigNumber(rate));
};
