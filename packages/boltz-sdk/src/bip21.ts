import { BigNumber } from "bignumber.js";

import { BTC, LBTC, LN } from "./assets";

export const bitcoinPrefix = "bitcoin:";
export const liquidPrefix = "liquidnetwork:";
export const liquidTestnetPrefix = "liquidtestnet:";
export const invoicePrefix = "lightning:";

/**
 * Checks if a string is a BIP21 URI (bitcoin:, liquidnetwork:, or liquidtestnet:)
 */
export const isBip21 = (data: string): boolean => {
    if (typeof data !== "string") {
        return false;
    }

    const lowerData = data.toLowerCase();
    return (
        lowerData.startsWith(bitcoinPrefix) ||
        lowerData.startsWith(liquidPrefix) ||
        lowerData.startsWith(liquidTestnetPrefix)
    );
};

/**
 * Extracts the address from a BIP21 URI.
 * If the input is not a BIP21 URI, returns the input as-is.
 */
export const extractBip21Address = (data: string): string => {
    if (isBip21(data)) {
        const url = new URL(data);
        return url.pathname;
    }
    return data;
};

/**
 * Extracts the amount parameter from a BIP21 URI.
 * Returns null if the input is not a BIP21 URI or if no amount is specified.
 */
export const extractBip21Amount = (data: string): BigNumber | null => {
    if (isBip21(data)) {
        const url = new URL(data);
        const amount = url.searchParams.get("amount");
        return BigNumber(amount || 0);
    }
    return null;
};

/**
 * Determines the asset type based on a BIP21 prefix.
 */
export const getAssetByBip21Prefix = (prefix: string): string => {
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
