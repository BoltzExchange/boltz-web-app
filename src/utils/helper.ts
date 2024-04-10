import { Buffer } from "buffer";
import { ECPairInterface } from "ecpair";
import log from "loglevel";

import { chooseUrl, config } from "../config";
import { BTC, LN } from "../consts";
import { SwapType } from "../consts/Enums";
import {
    ChainPairTypeTaproot,
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "./boltzClient";
import { ECPair } from "./ecpair";
import { ChainSwap, ReverseSwap, SomeSwap, SubmarineSwap } from "./swapCreator";

export const isIos = () =>
    !!navigator.userAgent.match(/iphone|ipad/gi) || false;
export const isMobile = () =>
    isIos() || !!navigator.userAgent.match(/android|blackberry/gi) || false;

export const parseBlindingKey = (swap: SomeSwap) => {
    let blindingKey: string | undefined;

    switch (swap.type) {
        case SwapType.Chain:
            blindingKey = (swap as ChainSwap).claimDetails.blindingKey;
            break;

        default:
            blindingKey = (swap as SubmarineSwap | ReverseSwap).blindingKey;
    }

    return blindingKey ? Buffer.from(blindingKey, "hex") : undefined;
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
    const found = config.assets[asset];
    return chooseUrl(found?.apiUrl ?? config.apiUrl);
};

export const coalesceLn = (asset: string) => (asset === LN ? BTC : asset);

export const getPair = <
    T extends
        | SubmarinePairTypeTaproot
        | ReversePairTypeTaproot
        | ChainPairTypeTaproot,
>(
    pairs: Pairs,
    swapType: SwapType,
    assetSend: string,
    assetReceive: string,
): T | undefined => {
    const pairSwapType = pairs[swapType];
    if (pairSwapType === undefined) return undefined;
    const pairAssetSend = pairSwapType[coalesceLn(assetSend)];
    if (pairAssetSend === undefined) return undefined;
    const pairAssetReceive = pairAssetSend[coalesceLn(assetReceive)];
    if (pairAssetReceive === undefined) return undefined;
    return pairAssetReceive as T;
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
