import { BigNumber } from "bignumber.js";

import { BTC, LBTC, LN } from "./assets";

/** BIP-21 URI prefix for on-chain Bitcoin payments. */
export const bitcoinPrefix = "bitcoin:";

/** BIP-21-style URI prefix for Liquid Network payments. */
export const liquidPrefix = "liquidnetwork:";

/** BIP-21-style URI prefix for Liquid testnet payments. */
export const liquidTestnetPrefix = "liquidtestnet:";

/** URI prefix for Lightning invoices (`lightning:`). */
export const invoicePrefix = "lightning:";

/**
 * Checks if a string is a BIP-21 URI (`bitcoin:`, `liquidnetwork:`, or `liquidtestnet:`).
 *
 * @param data - The string to test.
 * @returns `true` if `data` starts with a recognised BIP-21 prefix.
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
 * Extracts the address from a BIP-21 URI.
 * If the input is not a BIP-21 URI, returns the input as-is.
 *
 * @param data - A BIP-21 URI or plain address string.
 * @returns The extracted address.
 */
export const extractBip21Address = (data: string): string => {
    if (isBip21(data)) {
        const url = new URL(data);
        return url.pathname;
    }
    return data;
};

/**
 * Extracts the `amount` query parameter from a BIP-21 URI.
 *
 * @param data - A BIP-21 URI string.
 * @returns The amount as a {@link BigNumber}, or `null` if the input is not a BIP-21 URI.
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
 * Map a BIP-21 URI prefix to its corresponding asset identifier.
 *
 * @param prefix - One of the known URI prefixes (e.g. `"bitcoin:"`).
 * @returns The matching {@link AssetType} string, or `""` for unknown prefixes.
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
