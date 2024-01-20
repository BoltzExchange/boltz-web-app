import { Buffer } from "buffer";
import log from "loglevel";

import { pairs } from "../config";
import { BTC } from "../consts";
import {
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "./boltzClient";

export const isIos = !!navigator.userAgent.match(/iphone|ipad/gi) || false;
export const isMobile =
    isIos || !!navigator.userAgent.match(/android|blackberry/gi) || false;

export const parseBlindingKey = (swap: { blindingKey: string | undefined }) => {
    return swap.blindingKey ? Buffer.from(swap.blindingKey, "hex") : undefined;
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

export const getApiUrl = (asset: string) => {
    const pair = pairs[`${asset}/BTC`];
    if (pair) {
        return pair.apiUrl;
    }

    log.error(`no pair found for ${asset}; falling back to ${BTC}`);
    return getApiUrl(BTC);
};

export const getPair = <
    T extends SubmarinePairTypeTaproot | ReversePairTypeTaproot,
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

export const fetcher = async <T = any>(
    url: string,
    asset: string = BTC,
    params: any | undefined = null,
): Promise<T> => {
    let opts = {};
    if (params) {
        opts = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        };
    }
    const apiUrl = getApiUrl(asset) + url;
    const response = await fetch(apiUrl, opts);
    if (!response.ok) {
        return Promise.reject(response);
    }
    return response.json();
};
