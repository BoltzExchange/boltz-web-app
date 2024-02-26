import log from "loglevel";

import { config } from "../config";
import { BTC, LBTC } from "../consts";
import type {
    PairLegacy,
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "./types";

export const isBoltzClient = () => config().boltzClientApiUrl !== "";
export const isBoltzClientEnabled = true;
export const isIos = !!navigator.userAgent.match(/iphone|ipad/gi) || false;
export const isMobile =
    isIos || !!navigator.userAgent.match(/android|blackberry/gi) || false;

export const clientFetcher = async <T = any>(
    url: string,
    params: any | undefined = null,
): Promise<T> => {
    let opts = {};
    if (params) {
        opts = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Grpc-Metadata-macaroon": "",
            },
            body: JSON.stringify(params),
        };
    }
    const response = await fetch(config().boltzClientApiUrl + url, opts);
    if (!response.ok) {
        return Promise.reject(response);
    }
    return response.json();
};

export const getPairs = async (): Promise<any> => {
    const pairs = await clientFetcher("/v1/pairs");

    const parseCurrency = (currency: string) =>
        currency == "BTC" ? BTC : LBTC;

    const transform = (pairs: any[]) =>
        pairs.reduce((acc, pair) => {
            const from = parseCurrency(pair.pair.from);
            const to = parseCurrency(pair.pair.to);
            acc[from] = acc[from] || {};
            acc[from][to] = pair;
            return acc;
        }, {});

    return {
        reverse: transform(pairs.reverse),
        submarine: transform(pairs.submarine),
    };
};

export const cropString = (str: string) => {
    if (str.length < 40) {
        return str;
    }
    return str.substring(0, 19) + "..." + str.substring(str.length - 19);
};

export const clipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

export const getPair = <
    T extends SubmarinePairTypeTaproot | ReversePairTypeTaproot | PairLegacy,
>(
    pairs: Pairs,
    asset: string,
    isReverse: boolean,
): T | undefined => {
    try {
        if (isReverse) {
            return pairs.reverse[BTC][asset] as T;
        }

        return pairs.submarine[asset][BTC] as T;
    } catch (e) {
        log.debug(`could not get pair ${asset} (reverse ${isReverse}): ${e}`);
        return undefined;
    }
};
