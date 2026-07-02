import { BigNumber } from "bignumber.js";

import { BTC, LBTC, LN } from "../consts/Assets";

export { isInvoice } from "boltz-swaps/invoice";
export { isLnurl } from "boltz-swaps/lnurl";

export const invoicePrefix = "lightning:";
export const bitcoinPrefix = "bitcoin:";
export const liquidPrefix = "liquidnetwork:";
export const liquidTestnetPrefix = "liquidtestnet:";

export const maxExpiryHours = 24;

export const isBip21 = (data: string) => {
    if (typeof data !== "string") {
        return false;
    }

    data = data.toLowerCase();
    return (
        data.startsWith(bitcoinPrefix) ||
        data.startsWith(liquidPrefix) ||
        data.startsWith(liquidTestnetPrefix)
    );
};

// BIP-321 makes query parameter keys case-insensitive,
// which is common practice for all-uppercase URIs in QR codes
const getBip21Param = (url: URL, key: string): string | null => {
    const keyLower = key.toLowerCase();

    for (const [paramKey, value] of url.searchParams) {
        if (paramKey.toLowerCase() === keyLower) {
            return value;
        }
    }
    return null;
};

export const extractInvoice = (data: string) => {
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

export const extractAddress = (data: string) => {
    if (isBip21(data)) {
        const url = new URL(data);
        return url.pathname;
    }
    return data;
};

export const extractBip21Amount = (data: string) => {
    if (isBip21(data)) {
        const url = new URL(data);
        const amount = getBip21Param(url, "amount");
        if (amount === null) {
            return null;
        }

        try {
            const value = BigNumber(amount);
            // Treat empty or malformed amounts as absent instead of
            // failing the whole URI
            return value.isNaN() ? null : value;
        } catch {
            return null;
        }
    }
    return null;
};

export const getAssetByBip21Prefix = (prefix: string) => {
    switch (prefix) {
        case bitcoinPrefix:
            return BTC;
        case liquidPrefix:
        case liquidTestnetPrefix:
            return LBTC;
        case invoicePrefix:
            return LN;
        default:
            return "";
    }
};
