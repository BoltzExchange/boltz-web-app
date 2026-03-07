import { BigNumber } from "bignumber.js";

import { Denomination } from "../public/enums";

/** Default HTTP request timeout in milliseconds (15 s). */
export const defaultTimeoutDuration = 15_000;


/**
 * Unwrap a value that may be either a plain value or a zero-argument getter.
 *
 * @param value - The value or getter to resolve.
 * @returns The resolved value.
 */
export const resolveValue = <T>(value: T | (() => T)): T =>
    typeof value === "function" ? (value as () => T)() : value;

/**
 * Assert that a `fetch` response is OK and parse its JSON body.
 *
 * @typeParam T - Expected shape of the parsed JSON body.
 * @param response - The `Response` object to check.
 * @returns The parsed JSON body.
 * @throws Rejects with the raw `Response` when `response.ok` is `false`.
 */
export const checkResponse = <T = unknown>(response: Response): Promise<T> => {
    if (!response.ok) {
        return Promise.reject(response);
    }
    return response.json();
};

/** Millisatoshi multiplier (1 sat = 1 000 msat). */
const miliFactor = 1_000;

/** Satoshi multiplier (1 BTC = 100 000 000 sat). */
const satFactor = 100_000_000;

/**
 * Format an amount for display in a specific denomination.
 *
 * - **BTC**: divides by {@link satFactor} and returns a decimal string.
 * - **Sat** (default): groups digits in threes for readability.
 *
 * @param amount - The amount in satoshis.
 * @param denomination - Target denomination for formatting.
 * @param separator - Decimal separator character (`"."` or `","`).
 * @param fixed - When `true` and denomination is BTC, always show 8 decimal places.
 * @returns The formatted amount string.
 */
export const formatAmountDenomination = (
    amount: BigNumber,
    denomination: Denomination,
    separator: string,
    fixed: boolean = false,
): string => {
    switch (denomination) {
        case Denomination.Btc: {
            const amountBig = amount.div(satFactor);
            let amountString = amountBig.toString();
            if (fixed) {
                amountString = amountBig.toFixed(8);
                return amountString;
            }
            if (amountBig.isZero()) {
                amountString = amountBig.toFixed(1);
            }

            // 0.00000001.toString() returns "1e-8"
            // 0.0000001.toString() returns "1e-7"
            if (amountBig.toString().indexOf("-") !== -1) {
                amountString = amountBig.toFixed(Number(8)).replace(/0+$/, "");
            }

            if (separator === ",") {
                amountString = amountString.replace(".", ",");
            }

            return amountString;
        }

        default: {
            const chars = amount.toString().split("").reverse();
            const formatted = chars
                .reduce(
                    (acc, char, i) =>
                        i % 3 === 0 ? acc + " " + char : acc + char,
                    "",
                )
                .trim()
                .split("")
                .reverse()
                .join("");

            return (
                formatted.includes(".") || formatted.includes(",")
                    ? formatted.replaceAll(" .", ".").replaceAll(" ,", ",")
                    : formatted
            ).replaceAll(".", separator);
        }
    }
};

/**
 * Convert satoshis to millisatoshis.
 *
 * @param sat - Amount in satoshis.
 * @returns Equivalent amount in millisatoshis.
 */
export const satToMiliSat = (sat: BigNumber) => {
    return sat.multipliedBy(miliFactor);
};

/**
 * BOLT-11 human-readable prefixes per network.
 */
export const bolt11Prefixes: Record<string, string> = {
    mainnet: "lnbc",
    testnet: "lntb",
    regtest: "lnbcrt",
};
