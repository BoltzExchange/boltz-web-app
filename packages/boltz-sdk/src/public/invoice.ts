import { bech32, utf8 } from "@scure/base";
import { BigNumber } from "bignumber.js";
import bolt11 from "bolt11";

import {
    bolt11Prefixes,
    checkResponse,
    resolveValue,
    satToMiliSat,
} from "../internal/utils";
import { invoicePrefix, isBip21 } from "./bip21";
import type { NetworkType } from "./config";
import { getConfig } from "./config";
import { InvoiceValidation } from "./enums";

/** Lightning invoice encoding formats. */
export enum InvoiceType {
    Bolt11,
    Bolt12,
}

/** Shape of the initial LNURL JSON response (`/.well-known/lnurlp/…`). */
export type LnurlResponse = {
    minSendable: number;
    maxSendable: number;
    callback: string;
};

/** Shape of the LNURL callback response containing the generated invoice. */
type LnurlCallbackResponse = {
    /** BOLT-11 payment request string. */
    pr: string;
};

/** Maximum allowed invoice expiry in hours. */
export const maxExpiryHours = 24;

const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

/**
 * Check whether a string is valid bech32 encoding.
 *
 * @param data - The string to test.
 * @returns `true` if `data` can be decoded as bech32.
 */
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

/**
 * Extract a Lightning invoice from a raw input string.
 *
 * Handles `lightning:` URIs, BIP-21 URIs (via `lightning` or `lno` query
 * params), and plain invoice strings.
 *
 * @param data - Raw user input (may be a URI or plain invoice).
 * @returns The extracted invoice string, or `null` if extraction failed.
 */
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
 *
 * @param data - The string to check.
 * @param network - Optional network override; defaults to the SDK-configured network.
 * @returns `true` if `data` starts with the expected BOLT-11 prefix.
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

/**
 * Detect whether a string is an LNURL or Lightning address.
 *
 * Recognises both `lnurl1…` bech32 strings and `user@domain` Lightning
 * addresses.
 *
 * @param data - The string to check.
 * @returns `true` if `data` is an LNURL or Lightning address.
 */
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
 * Decode a BOLT-11 invoice.
 *
 * @param invoice - BOLT-11 encoded payment request.
 * @returns An object containing the invoice type, satoshi amount, and preimage hash.
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

/**
 * Validate that the requested amount is within the LNURL min/max bounds.
 *
 * @param amount - The amount in millisatoshis to validate.
 * @param data - The LNURL response containing `minSendable` / `maxSendable`.
 * @returns The validated {@link LnurlResponse}.
 * @throws With {@link InvoiceValidation.MinAmount} or {@link InvoiceValidation.MaxAmount}.
 */
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

/**
 * Call the LNURL callback with the given amount and return the generated invoice.
 *
 * @param amount - Amount in millisatoshis.
 * @param data - The LNURL response containing the callback URL.
 * @returns The BOLT-11 payment request string.
 */
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

/**
 * Resolve an LNURL or Lightning address into a BOLT-11 invoice.
 *
 * 1. Converts Lightning addresses (`user@domain`) to the well-known LNURL endpoint.
 * 2. Decodes bech32-encoded LNURLs.
 * 3. Fetches the LNURL JSON, validates the amount, and requests an invoice.
 *
 * @param lnurl - LNURL bech32 string or Lightning address.
 * @param amountSat - Desired payment amount in satoshis.
 * @returns The BOLT-11 payment request string.
 */
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
