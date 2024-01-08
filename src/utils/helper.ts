import { Buffer } from "buffer";
import log from "loglevel";

import { pairs } from "../config";
import { BTC } from "../consts";
import { checkResponse } from "../utils/http";

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

export const startInterval = (cb: () => any, interval: number) => {
    cb();
    return setInterval(cb, interval);
};

export const clipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

export const errorHandler = (error: any) => {
    if (typeof error.json === "function") {
        error
            .json()
            .then((jsonError: any) => {
                log.error(jsonError);
            })
            .catch((genericError: any) => {
                log.error(genericError);
            });
    } else {
        log.error(error.message);
    }
};

export const getApiUrl = (asset: string) => {
    const pair = pairs[`${asset}/BTC`];
    if (pair) {
        return pair.apiUrl;
    }

    log.error(`no pair found for ${asset}; falling back to ${BTC}`);
    return getApiUrl(BTC);
};

export const fetcher = (
    url: string,
    asset: string = BTC,
    cb: (value: any) => void,
    params: any | undefined = null,
    errorCb = errorHandler,
) => {
    let opts = {};
    if (params) {
        // TODO: add referralId
        // params.referralId = ref();
        opts = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        };
    }
    const apiUrl = getApiUrl(asset) + url;
    fetch(apiUrl, opts).then(checkResponse).then(cb).catch(errorCb);
};

export async function getfeeestimation(swap: any): Promise<number> {
    return new Promise((resolve) => {
        fetcher("/getfeeestimation", swap.asset, (data: any) => {
            log.debug("getfeeestimation: ", data);
            let asset = swap.asset;
            resolve(data[asset]);
        });
    });
}

export const fetchPairs = () => {
    fetcher(
        "/getpairs",
        BTC,
        (data: any) => {
            log.debug("getpairs", data);
            // setOnline(true);
            // setConfig(data.pairs);
        },
        null,
        (error) => {
            log.debug(error);
            // TODO
            // setOnline(false);
        },
    );
    return false;
};

export default fetcher;
