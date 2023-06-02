import { denomination, maximum } from "../signals";
import { BigNumber } from "bignumber.js";

export const satFactor = 100_000_000;

export const denominations = {
    sat: "sat",
    btc: "btc",
};

export const getValidationRegex = () => {
    const digits = calculateDigits();
    const regex =
        denomination() == denominations.sat
            ? "^[0-9]{1," + digits + "}$"
            : "^[0-9].[0-9]{1," + digits + "}$";
    return new RegExp(regex);
};

export const formatAmount = (amount, fixed = false) => {
    switch (denomination()) {
        case denominations.btc:
            let amountBig = new BigNumber(amount).div(satFactor);
            if (fixed) {
                return amountBig.toFixed(8);
            }
            if (amountBig.isZero()) {
                return amountBig.toFixed(1);
            }
            return amountBig.toNumber();
        case denominations.sat:
            return Number(amount);
    }
};

export const convertAmount = (amount) => {
    switch (denomination()) {
        case denominations.btc:
            let amountBig = new BigNumber(amount).multipliedBy(satFactor);
            return amountBig.toNumber();
        case denominations.sat:
            return Number(amount);
    }
};

export const calculateDigits = () => {
    let digits = maximum().toString().length;
    if (denomination() === denominations.btc) {
        if (digits < 10) {
            digits = 10;
        } else {
            digits += 1;
        }
    }
    return digits;
};
