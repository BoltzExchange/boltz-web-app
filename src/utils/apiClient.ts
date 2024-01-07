import log from "loglevel";

import { pairs } from "../config";
import { BTC } from "../consts";
import { asset, ref, setNotification, setNotificationType } from "../signals";
import { checkResponse } from "./http";

export const getApiUrl = (asset: string) => {
    const pair = pairs[`${asset}/BTC`];
    if (pair) {
        return pair.apiUrl;
    }

    log.error(`no pair found for ${asset}; falling back to ${BTC}`);
    return getApiUrl(BTC);
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

export const fetcher = (
    url: string,
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
    const apiUrl = getApiUrl(asset()) + url;
    fetch(apiUrl, opts).then(checkResponse).then(cb).catch(errorCb);
};
