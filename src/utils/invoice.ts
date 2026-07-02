import { bech32, utf8 } from "@scure/base";
import { BigNumber } from "bignumber.js";
import { fetchBolt12Invoice } from "boltz-swaps/client";
import { isBolt12Offer, validateInvoiceForOffer } from "boltz-swaps/invoice";
import log from "loglevel";

import { config } from "../config";
import { BTC, LBTC, LN } from "../consts/Assets";
import { type Denomination, InvoiceValidation } from "../consts/Enums";
import type { ButtonLabelParams } from "../consts/Types";
import {
    formatAmount,
    formatDenomination,
    miliSatToSat,
    satToMiliSat,
} from "./denomination";
import { lookup } from "./dnssec/dohLookup";
import { checkResponse } from "./http";
import { firstResolved, promiseWithTimeout } from "./promise";

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

const bolt11Prefixes = {
    mainnet: "lnbc",
    testnet: "lntb",
    regtest: "lnbcrt",
};

const bip353Prefix = "₿";
const invoiceFetchTimeout = 25_000;

export const isInvoiceValidationError = (error: unknown): error is Error =>
    error instanceof Error &&
    (Object.values(InvoiceValidation) as string[]).includes(error.message);

export const invoiceAmountLabel = (
    error: Error,
    options: {
        denomination: Denomination;
        separator: string;
        asset: string;
    },
): ButtonLabelParams | undefined => {
    if (!isInvoiceValidationError(error)) {
        return undefined;
    }

    let key: ButtonLabelParams["key"];
    switch (error.message) {
        case InvoiceValidation.MinAmount:
            key = "min_amount_destination";
            break;
        case InvoiceValidation.MaxAmount:
            key = "max_amount_destination";
            break;
        default: {
            const unhandled: never = error.message as never;
            return unhandled;
        }
    }

    return {
        key,
        params: {
            amount: formatAmount(
                miliSatToSat(BigNumber(error.cause as BigNumber.Value)),
                options.denomination,
                options.separator,
                options.asset,
            ),
            denomination: formatDenomination(
                options.denomination,
                options.asset,
            ),
        },
    };
};

export const fetchLnurl = async (
    lnurl: string,
    amount_sat: number,
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

    const amount = satToMiliSat(BigNumber(amount_sat));

    log.debug("Fetching LNURL:", url);

    const res = await checkResponse<LnurlResponse>(await fetch(url));
    checkLnurlResponse(amount, res);

    return await fetchLnurlInvoice(amount, res);
};

export const resolveBip353 = async (bip353: string): Promise<string> => {
    const split = bip353.split("@");
    if (split.length !== 2) {
        throw "invalid BIP-353";
    }

    if (split[0].startsWith(bip353Prefix)) {
        split[0] = split[0].substring(bip353Prefix.length);
    }

    log.debug(`Fetching BIP-353: ${bip353}`);

    const res = await lookup(
        `${split[0]}.user._bitcoin-payment.${split[1]}`,
        "txt",
        config.dnsOverHttps,
    );

    const nowUnix = Date.now() / 1_000;
    if (nowUnix < res.valid_from) {
        throw "proof is not valid yet";
    }
    if (nowUnix > res.expires) {
        throw "proof has expired";
    }

    if (res.verified_rrs === undefined || res.verified_rrs.length === 0) {
        throw "no TXT record";
    }

    if (res.verified_rrs[0].type !== "txt") {
        throw "invalid proof";
    }

    const paymentRequest = res.verified_rrs[0].contents;
    const offerParam = new URLSearchParams(paymentRequest.split("?")[1]).get(
        "lno",
    );
    if (offerParam === null) {
        throw new Error("missing lno parameter in bip353 payment request");
    }
    const offer = offerParam.replaceAll('"', "");

    log.debug("Resolved offer for BIP-353:", offer);
    return offer;
};

export const fetchBip353 = async (
    bip353: string,
    amountSat: number,
): Promise<string> => {
    const offer = await resolveBip353(bip353);
    const invoice = (await fetchBolt12Invoice(offer, amountSat)).invoice;
    validateInvoiceForOffer(offer, invoice);
    log.debug(`Resolved invoice for offer:`, invoice);

    return invoice;
};

export const fetchDeferredInvoice = async (
    destination: string,
    amountSat: number,
): Promise<string> => {
    const invoiceInput =
        extractInvoice(destination.trim()) ?? destination.trim();

    if (isLnurl(invoiceInput)) {
        let lnurlError: unknown;
        const lnurlInvoice = fetchLnurl(invoiceInput, amountSat).catch(
            (error) => {
                lnurlError = error;
                throw error;
            },
        );

        try {
            return await firstResolved(
                [lnurlInvoice, fetchBip353(invoiceInput, amountSat)].map(
                    (promise) =>
                        promiseWithTimeout(promise, invoiceFetchTimeout),
                ),
            );
        } catch (error) {
            if (isInvoiceValidationError(lnurlError)) {
                throw lnurlError;
            }

            throw error;
        }
    }

    const invoice = (await fetchBolt12Invoice(invoiceInput, amountSat)).invoice;
    validateInvoiceForOffer(invoiceInput, invoice);
    return invoice;
};

const checkLnurlResponse = (amount: BigNumber, data: LnurlResponse) => {
    log.debug(
        "lnurl amount check: (x, min, max)",
        amount.toString(),
        data.minSendable,
        data.maxSendable,
    );

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
) => {
    const url = new URL(data.callback);
    url.searchParams.set("amount", amount.toString());
    log.debug("fetching invoice", url.toString());
    const res = await fetch(url.toString()).then(
        checkResponse<LnurlCallbackResponse>,
    );
    log.debug("fetched invoice", res);
    return res.pr;
};

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

    data = data.trim().toLowerCase();
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

export const isInvoice = (data: string) => {
    if (typeof data !== "string") {
        return false;
    }

    const prefix =
        bolt11Prefixes[config.network as keyof typeof bolt11Prefixes];
    const startsWithPrefix = data.toLowerCase().startsWith(prefix);
    if (prefix === bolt11Prefixes.mainnet && startsWithPrefix) {
        return !data.toLowerCase().startsWith(bolt11Prefixes.regtest);
    }
    return startsWithPrefix || data.toLowerCase().startsWith("lni");
};

const isValidBech32 = (data: string) => {
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

const emailRegex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const isLnurl = (data: string | null | undefined) => {
    if (typeof data !== "string") {
        return false;
    }

    data = data.toLowerCase().replace(invoicePrefix, "");
    return (
        (data.includes("@") && emailRegex.test(data)) ||
        (data.startsWith("lnurl") && isValidBech32(data))
    );
};

export const isDeferredInvoiceDestination = (
    value: string | undefined,
): value is string => {
    if (value === undefined) {
        return false;
    }

    const invoiceInput = extractInvoice(value.trim()) ?? "";
    return (
        invoiceInput !== "" &&
        (isLnurl(invoiceInput) || isBolt12Offer(invoiceInput))
    );
};
