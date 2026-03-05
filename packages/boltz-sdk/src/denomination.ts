import { Denomination } from "./enums";

const miliFactor = 1_000;
const satFactor = 100_000_000;

/**
 * Format an amount for display in a specific denomination.
 * Internal to the SDK -- used by validation.ts for error messages.
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

export const convertAmount = (amount: BigNumber, denom: string): BigNumber => {
    switch (denom) {
        case Denomination.Btc:
            return amount.multipliedBy(satFactor);
        default:
            return amount;
    }
};

export const btcToSat = (btc: BigNumber) => {
    return btc.multipliedBy(satFactor);
};

export const satToBtc = (sat: BigNumber) => {
    return sat.dividedBy(satFactor);
};

export const satToMiliSat = (sat: BigNumber) => {
    return sat.multipliedBy(miliFactor);
};

export const miliSatToSat = (sat: BigNumber) => {
    return sat.dividedBy(miliFactor);
};
