import BigNumber from "bignumber.js";

import { baseConfig } from "../configs/base";
import { BTC } from "../consts/Assets";
import { Currency } from "../consts/Enums";
import { satToBtc } from "./denomination";
import { constructRequestOptions } from "./helper";

const getBtcPriceYadio = async (currency: Currency) => {
    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const response = await fetch(baseConfig.rateProviders.Yadio, opts);

        const data = (await response.json()) as {
            BTC: Record<string, number>;
        };

        return BigNumber(data[BTC][currency]);
    } catch (e) {
        throw new Error("failed to get BTC price from Yadio", e);
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getBtcPriceKraken = async (currency: Currency) => {
    type KrakenResponse = {
        result: {
            XXBTZUSD: {
                c: [string, string];
            };
        };
    };

    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const response = await fetch(
            `${baseConfig.rateProviders.Kraken}?pair=XXBTZ${currency}`,
            opts,
        );
        const data = (await response.json()) as KrakenResponse;
        return BigNumber(data.result.XXBTZUSD.c[0]);
    } catch (e) {
        throw new Error("failed to get BTC price from Kraken: ", e);
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getBtcPriceMempool = async (currency: Currency) => {
    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const response = await fetch(baseConfig.rateProviders.Mempool, opts);
        const data = (await response.json()) as { [currency: string]: number };
        return BigNumber(data[currency]);
    } catch (e) {
        throw new Error("failed to get BTC price from Mempool: ", e);
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getBtcPriceFailover = async (
    currency: Currency = Currency.USD,
) => {
    for (const getBtcPrice of [
        getBtcPriceMempool,
        getBtcPriceKraken,
        getBtcPriceYadio,
    ]) {
        try {
            return await getBtcPrice(currency);
        } catch {
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
