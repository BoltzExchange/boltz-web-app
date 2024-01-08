import { Buffer } from "buffer";
import log from "loglevel";

import { pairs } from "../config";
import { BTC } from "../consts";
import {
    ref,
    setConfig,
    setNotification,
    setNotificationType,
    setOnline,
    setRef,
} from "../signals";
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

export const checkReferralId = () => {
    const refParam = new URLSearchParams(window.location.search).get("ref");
    if (refParam && refParam !== "") {
        setRef(refParam);
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
        );
    }
};

export const startInterval = (cb: () => any, interval: number) => {
    cb();
    return setInterval(cb, interval);
};

export const clipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    setNotificationType("success");
    setNotification(message);
};

export const errorHandler = (error: any) => {
    log.error(error);
    setNotificationType("error");
    if (typeof error.json === "function") {
        error
            .json()
            .then((jsonError: any) => {
                setNotification(jsonError.error);
            })
            .catch((genericError: any) => {
                log.error(genericError);
                setNotification(error.statusText);
            });
    } else {
        setNotification(error.message);
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
        params.referralId = ref();
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
            setOnline(true);
            setConfig(data.pairs);
        },
        null,
        (error) => {
            log.debug(error);
            setOnline(false);
        },
    );
    return false;
};

export default fetcher;
