import { Buffer } from "buffer";
import { ECPairInterface } from "ecpair";
import log from "loglevel";

import { pairs } from "../config";
import { BTC, RBTC } from "../consts";
import {
    PairLegacy,
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "./boltzClient";
import { ECPair } from "./ecpair";

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

export const getApiUrl = (asset: string): string => {
    const pair = pairs[`${asset}/BTC`];
    if (pair) {
        return pair.apiUrl;
    }

    log.error(`no pair found for ${asset}; falling back to ${BTC}`);
    return getApiUrl(BTC);
};

export const isLegacy = (asset: string) => asset === RBTC;

export const getPair = <
    T extends SubmarinePairTypeTaproot | ReversePairTypeTaproot | PairLegacy,
>(
    pairs: Pairs,
    asset: string,
    isReverse: boolean,
): T | undefined => {
    try {
        if (isLegacy(asset)) {
            return pairs.legacy.pairs[`${asset}/${BTC}`] as T;
        }

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

export const parsePrivateKey = (privateKey: string): ECPairInterface => {
    try {
        return ECPair.fromPrivateKey(Buffer.from(privateKey, "hex"));
    } catch (e) {
        // When the private key is not HEX, we try to decode it as WIF
        return ECPair.fromWIF(privateKey);
    }
};
