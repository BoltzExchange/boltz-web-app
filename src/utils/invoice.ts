import { bech32, utf8 } from "@scure/base";
import bolt11 from "bolt11";
import log from "loglevel";

import { bolt11_prefix } from "../config";
import { errorHandler } from "../helper";
import t from "../i18n";
import { checkResponse } from "./http";

type LnurlResponse = {
    minSendable: number;
    maxSendable: number;
    callback: string;
};

type LnurlCallbackResponse = {
    pr: string;
};

export const invoicePrefix = "lightning:";
export const bitcoinPrefix = "bitcoin:";
export const liquidPrefix = "liquidnetwork:";
export const liquidTestnetPrefix = "liquidtestnet:";

export const maxExpiryHours = 24;

export const getExpiryEtaHours = (invoice: string): number => {
    const decoded = decodeInvoice(invoice);
    const now = Date.now() / 1000;
    const delta = (decoded.expiry || 0) - now;
    if (delta < 0) {
        return 0;
    }
    const eta = Math.round(delta / 60 / 60);
    if (eta > maxExpiryHours) {
        return maxExpiryHours;
    }
    return eta;
};

export const decodeInvoice = (
    invoice: string,
): { satoshis: number; preimageHash: string; expiry?: number } => {
    try {
        const decoded = bolt11.decode(invoice);
        return {
            satoshis: decoded.satoshis,
            expiry: decoded.timeExpireDate,
            preimageHash: decoded.tags.find(
                (tag) => tag.tagName === "payment_hash",
            ).data as string,
        };
    } catch (e) {
        throw new Error(t("invalid_invoice"));
    }
};

export const fetchLnurl = (
    lnurl: string,
    amount_sat: number,
): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        let url: string;
        const amount = Math.round(amount_sat * 1000);

        if (lnurl.includes("@")) {
            // Lightning address
            const urlsplit = lnurl.split("@");
            url = `https://${urlsplit[1]}/.well-known/lnurlp/${urlsplit[0]}`;
        } else {
            // LNURL
            const { bytes } = bech32.decodeToBytes(lnurl);
            url = utf8.encode(bytes);
        }

        log.debug("fetching lnurl:", url);
        fetch(url)
            .then(checkResponse<LnurlResponse>)
            .then((data) => {
                log.debug(
                    "amount check: (x, min, max)",
                    amount,
                    data.minSendable,
                    data.maxSendable,
                );
                if (amount < data.minSendable || amount > data.maxSendable) {
                    return reject("Amount not in LNURL range.");
                }
                log.debug(
                    "fetching invoice",
                    `${data.callback}?amount=${amount}`,
                );
                fetch(`${data.callback}?amount=${amount}`)
                    .then(checkResponse<LnurlCallbackResponse>)
                    .then((data) => {
                        log.debug("fetched invoice", data);
                        resolve(data.pr);
                    })
                    .catch((e) => {
                        errorHandler(e);
                        reject(e);
                    });
            })
            .catch((e) => {
                errorHandler(e);
                reject(e);
            });
    });
};

export const isBip21 = (data: string) => {
    data = data.toLowerCase();
    return (
        data.startsWith(bitcoinPrefix) ||
        data.startsWith(liquidPrefix) ||
        data.startsWith(liquidTestnetPrefix)
    );
};

export const extractInvoice = (data: string) => {
    data = data.toLowerCase();
    if (data.startsWith(invoicePrefix)) {
        const url = new URL(data);
        return url.pathname;
    }
    if (isBip21(data)) {
        const url = new URL(data);
        return url.searchParams.get("lightning") || "";
    }
    return data;
};

export const extractAddress = (data: string) => {
    if (isBip21(data)) {
        const url = new URL(data);
        return url.pathname;
    }
    return data;
};

export const isInvoice = (data: string) => {
    return data.toLowerCase().startsWith(bolt11_prefix);
};

const isValidBech32 = (data: string) => {
    try {
        bech32.decodeToBytes(data);
        return true;
    } catch (e) {
        return false;
    }
};

const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const isLnurl = (data: string) => {
    data = data.toLowerCase().replace(invoicePrefix, "");
    return (
        (data.includes("@") && emailRegex.test(data)) ||
        (data.startsWith("lnurl") && isValidBech32(data))
    );
};
