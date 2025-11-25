import { BigNumber } from "bignumber.js";

import { Denomination } from "../consts/Enums";

const miliFactor = 1_000;
const satFactor = 100_000_000;

export const getValidationRegex = (maximum: number): RegExp => {
    const digits = maximum.toString().length;
    const firstDigit = BigNumber(maximum).div(satFactor).toString().charAt(0);
    const firstDigitRegex = firstDigit === "0" ? `0` : `0-${firstDigit}`;
    const regex = `^[0-9]{1,${digits}}$|^[${firstDigitRegex}]((\\.|,)[0-9]{1,8}){0,1}$`;
    return new RegExp(regex);
};

export const formatAmount = (
    amount: BigNumber,
    denomination: Denomination,
    separator: string,
    fixed: boolean = false,
): string => {
    return formatAmountDenomination(amount, denomination, separator, fixed);
};

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

export const formatDenomination = (denom: Denomination, asset: string) =>
    denom === Denomination.Sat ? "sats" : asset;

export const convertAmount = (amount: BigNumber, denom: string): BigNumber => {
    switch (denom) {
        case Denomination.Btc:
            return amount.multipliedBy(satFactor);
        default:
            return amount;
    }
};

export const calculateDigits = (
    maximum: number,
    denomination: string,
): number => {
    let digits = maximum.toString().length;
    if (denomination === Denomination.Btc && digits < 10) {
        digits = 10;
    } else if (denomination === Denomination.Btc) {
        // account for decimal point
        digits += 1;
    } else {
        // account for spaces
        digits += Math.floor((digits - 1) / 3);
    }

    return digits;
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
