import { bech32, utf8 } from "@scure/base";
import { BigNumber } from "bignumber.js";
import bolt11 from "bolt11";

import { invoicePrefix, isBip21 } from "./bip21";
import type { NetworkType } from "./config";
import { getConfig } from "./config";
import { satToMiliSat } from "./denomination";
import { InvoiceValidation } from "./enums";
import { checkResponse } from "./http";

export enum InvoiceType {
    Bolt11,
    Bolt12,
}

export type LnurlResponse = {
    minSendable: number;
    maxSendable: number;
    callback: string;
};

type LnurlCallbackResponse = {
    pr: string;
};

export const maxExpiryHours = 24;

export const bolt11Prefixes: Record<string, string> = {
    mainnet: "lnbc",
    testnet: "lntb",
    regtest: "lnbcrt",
};

const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const isValidBech32 = (data: string): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    try {
        bech32.decodeToBytes(data);
        return true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

export const extractInvoice = (data: string): string | null => {
    if (typeof data !== "string") {
        return null;
    }

    data = data.toLowerCase();
    if (data.startsWith(invoicePrefix)) {
        const url = new URL(data);
        return url.pathname;
    }
    if (isBip21(data)) {
        const url = new URL(data);
        return (
            url.searchParams.get("lightning") ||
            url.searchParams.get("lno") ||
            null
        );
    }
    return data;
};

/**
 * Detect whether a string looks like a BOLT-11 invoice for the configured
 * network (or the explicitly supplied one).
 */
export const isInvoice = (data: string, network?: NetworkType): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    const net = network ?? resolveValue(getConfig().network!);
    const prefix = bolt11Prefixes[net];
    const startsWithPrefix = data.toLowerCase().startsWith(prefix);
    if (prefix === bolt11Prefixes.mainnet && startsWithPrefix) {
        return !data.toLowerCase().startsWith(bolt11Prefixes.regtest);
    }
    return startsWithPrefix || data.toLowerCase().startsWith("lni");
};

export const isLnurl = (data: string | null | undefined): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    data = data.toLowerCase().replace(invoicePrefix, "");
    return (
        (data.includes("@") && emailRegex.test(data)) ||
        (data.startsWith("lnurl") && isValidBech32(data))
    );
};

/**
 * Decode a BOLT-11 invoice. Returns satoshi amount and preimage hash.
 * For BOLT-12 decoding, see the webapp's `decodeInvoice` which adds a
 * WASM-based fallback on top of this function.
 */
export const decodeBolt11Invoice = (
    invoice: string,
): { type: InvoiceType; satoshis: number; preimageHash: string } => {
    const decoded = bolt11.decode(invoice);
    const sats = BigNumber(decoded.millisatoshis || 0)
        .dividedBy(1000)
        .integerValue(BigNumber.ROUND_HALF_UP)
        .toNumber();
    return {
        satoshis: sats,
        type: InvoiceType.Bolt11,
        preimageHash: decoded.tags.find(
            (tag) => tag.tagName === "payment_hash",
        )!.data as string,
    };
};

export const checkLnurlResponse = (
    amount: BigNumber,
    data: LnurlResponse,
): LnurlResponse => {
    if (amount.isLessThan(BigNumber(data.minSendable))) {
        throw new Error(InvoiceValidation.MinAmount, {
            cause: data.minSendable,
        });
    }
    if (amount.isGreaterThan(BigNumber(data.maxSendable))) {
        throw new Error(InvoiceValidation.MaxAmount, {
            cause: data.maxSendable,
        });
    }
    return data;
};

export const fetchLnurlInvoice = async (
    amount: BigNumber,
    data: LnurlResponse,
): Promise<string> => {
    const url = new URL(data.callback);
    url.searchParams.set("amount", amount.toString());
    const res = await fetch(url.toString()).then(
        checkResponse<LnurlCallbackResponse>,
    );
    return res.pr;
};

export const fetchLnurl = async (
    lnurl: string,
    amountSat: number,
): Promise<string> => {
    let url: string;
    if (lnurl.includes("@")) {
        // Lightning address
        const urlsplit = lnurl.split("@");
        url = `https://${urlsplit[1]}/.well-known/lnurlp/${urlsplit[0]}`;
    } else {
        // LNURL
        const { bytes } = bech32.decodeToBytes(lnurl);
        url = utf8.encode(bytes);
    }

    const amount = satToMiliSat(BigNumber(amountSat));

    const res = await checkResponse<LnurlResponse>(await fetch(url));
    checkLnurlResponse(amount, res);

    return await fetchLnurlInvoice(amount, res);
};
