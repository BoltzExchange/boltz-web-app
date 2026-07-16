import { BigNumber } from "bignumber.js";
import { isLnurlAmountError } from "boltz-swaps/errors";
import { isBolt12Offer } from "boltz-swaps/invoice";
import { isLnurl } from "boltz-swaps/lnurl";
import { resolveInvoice } from "boltz-swaps/resolveInvoice";

import { BTC, LBTC, LN } from "../consts/Assets";
import { type Denomination, InvoiceValidation } from "../consts/Enums";
import type { ButtonLabelParams } from "../consts/Types";
import { formatAmount, formatDenomination } from "./denomination";

export { isInvoice } from "boltz-swaps/invoice";
export { isLnurl } from "boltz-swaps/lnurl";

export const invoicePrefix = "lightning:";
export const bitcoinPrefix = "bitcoin:";
export const liquidPrefix = "liquidnetwork:";
export const liquidTestnetPrefix = "liquidtestnet:";

export const maxExpiryHours = 24;

export const isInvoiceValidationError = (error: unknown): error is Error =>
    isLnurlAmountError(error) ||
    (error instanceof Error &&
        (Object.values(InvoiceValidation) as string[]).includes(error.message));

export const invoiceAmountLabel = (
    error: Error,
    options: {
        denomination: Denomination;
        separator: string;
        asset: string;
    },
): ButtonLabelParams | undefined => {
    if (isLnurlAmountError(error)) {
        return {
            key: `${error.kind}_amount_destination`,
            params: {
                amount: formatAmount(
                    BigNumber(error.limitSat),
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
    }

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
        case InvoiceValidation.ExactAmount:
            key = "exact_amount_destination";
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
                BigNumber(error.cause as BigNumber.Value),
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

export const fetchDeferredInvoice = async (
    destination: string,
    amountSat: number,
): Promise<string> => {
    const { invoice } = await resolveInvoice(destination, amountSat);
    return invoice;
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
