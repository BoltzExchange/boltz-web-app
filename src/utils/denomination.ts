import { BigNumber } from "bignumber.js";

export const satFactor = 100_000_000;

export const denominations = {
    sat: "sat",
    btc: "btc",
};

export const getValidationRegex = (
    maximum: number,
    denomination: string,
): RegExp => {
    const regex =
        denomination === denominations.sat
            ? `^[0-9]{1,${maximum.toString().length}}$`
            : `^[0-9](.[0-9]{1,10}){0,1}$`;
    return new RegExp(regex);
};

export const formatAmount = (
    amount: BigNumber,
    denomination: string,
    fixed: boolean = false,
): string => {
    return formatAmountDenomination(amount, denomination, fixed);
};

export const formatAmountDenomination = (
    amount: BigNumber,
    denomination: string,
    fixed: boolean = false,
): string => {
    switch (denomination) {
        case denominations.btc:
            const amountBig = amount.div(satFactor);
            if (fixed) {
                return amountBig.toFixed(8);
            }
            if (amountBig.isZero()) {
                return amountBig.toFixed(1);
            }
            // 0.00000001.toString() returns "1e-8"
            // 0.0000001.toString() returns "1e-7"
            if (amountBig.toString().indexOf("-") !== -1) {
                const digits = amountBig.toString().slice(-1);
                return amountBig.toFixed(Number(digits));
            }

            return amountBig.toString();

        default:
            const chars = amount.toString().split("").reverse();
            const formattedSats: string = chars
                .reduce(
                    (acc, char, i) =>
                        i % 3 === 0 ? acc + " " + char : acc + char,
                    "",
                )
                .trim()
                .split("")
                .reverse()
                .join("");
            return formattedSats;
    }
};

export const convertAmount = (amount: BigNumber, denom: string): BigNumber => {
    switch (denom) {
        case denominations.btc:
            const amountBig = amount.multipliedBy(satFactor);
            return amountBig;
        default:
            return amount;
    }
};

export const calculateDigits = (
    maximum: number,
    denomination: string,
): number => {
    let digits = maximum.toString().length;
    if (denomination === denominations.btc && digits < 10) {
        digits = 10;
    } else if (denomination === denominations.btc) {
        // account for decimal point
        digits += 1;
    } else {
        // account for spaces
        digits += Math.floor((digits - 1) / 3);
    }

    return digits;
};
