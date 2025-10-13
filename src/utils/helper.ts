import { Buffer } from "buffer";
import type { ECPairInterface } from "ecpair";

import { chooseUrl, config } from "../config";
import { BTC, LN, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { referralIdKey } from "../consts/LocalStorage";
import type { deriveKeyFn } from "../context/Global";
import { defaultReferral } from "../context/Global";
import type {
    ChainPairTypeTaproot,
    Pairs,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
} from "./boltzClient";
import { ECPair } from "./ecpair";
import { formatError } from "./errors";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "./swapCreator";

export const requestTimeoutDuration = 15_000;

export const isIos = () =>
    !!navigator.userAgent.match(/iphone|ipad/gi) || false;

export const isMobile = () =>
    isIos() || !!navigator.userAgent.match(/android|blackberry/gi) || false;

export const parseBlindingKey = (swap: SomeSwap, isRefund: boolean) => {
    let blindingKey: string | undefined;

    switch (swap.type) {
        case SwapType.Chain:
            if (isRefund) {
                blindingKey = (swap as ChainSwap).lockupDetails.blindingKey;
            } else {
                blindingKey = (swap as ChainSwap).claimDetails.blindingKey;
            }
            break;
        default:
            blindingKey = (swap as SubmarineSwap | ReverseSwap).blindingKey;
    }

    return blindingKey ? Buffer.from(blindingKey, "hex") : undefined;
};

export const cropString = (str: string, maxLen = 40, subStrSize = 19) => {
    if (str.length < maxLen) {
        return str;
    }
    return (
        str.substring(0, subStrSize) +
        "..." +
        str.substring(str.length - subStrSize)
    );
};

export const clipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
};

export const getApiUrl = (): string => {
    return chooseUrl(config.apiUrl);
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
    if (pairs === undefined) return undefined;

    const pairSwapType = pairs[swapType];
    if (pairSwapType === undefined) return undefined;
    const pairAssetSend = pairSwapType[coalesceLn(assetSend)];
    if (pairAssetSend === undefined) return undefined;
    const pairAssetReceive = pairAssetSend[coalesceLn(assetReceive)];
    if (pairAssetReceive === undefined) return undefined;
    return pairAssetReceive as T;
};

export const fetcher = async <T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: RequestInit,
): Promise<T> => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort({ reason: "Request timed out" }),
        requestTimeoutDuration,
    );

    try {
        // We cannot use the context here, so we get the data directly from local storage
        const referral =
            localStorage.getItem(referralIdKey) || defaultReferral();

        let opts: RequestInit = {
            headers: {
                referral,
            },
            signal: controller.signal,
        };

        if (params) {
            opts = {
                method: "POST",
                headers: {
                    ...(options ? options.headers : opts.headers),
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify(params),
            };
        }

        const apiUrl = getApiUrl() + url;
        const response = await fetch(apiUrl, options || opts);

        if (!response.ok) {
            try {
                const contentType = response.headers.get("content-type");
                if (contentType?.includes("application/json")) {
                    const body = await response.json();
                    return Promise.reject(formatError(body));
                }
                return Promise.reject(await response.text());

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return Promise.reject(response);
            }
        }
        return (await response.json()) as T;
    } catch (e) {
        throw new Error(e);
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const parsePrivateKey = (
    deriveKey: deriveKeyFn,
    keyIndex?: number,
    privateKeyHex?: string,
): ECPairInterface => {
    if (keyIndex !== undefined) {
        return deriveKey(keyIndex);
    }

    try {
        return ECPair.fromPrivateKey(Buffer.from(privateKeyHex, "hex"));

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        // When the private key is not HEX, we try to decode it as WIF
        return ECPair.fromWIF(privateKeyHex);
    }
};

export const getDestinationAddress = (swap: SomeSwap) => {
    if (swap === null || swap === undefined) {
        return "";
    }

    if (swap.assetReceive === RBTC) {
        return swap.signer;
    }

    if (swap.type === SwapType.Submarine) {
        return (swap as SubmarineSwap).invoice;
    }

    return swap.claimAddress;
};
