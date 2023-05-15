import { denomination } from "../signals";
import { BigNumber } from "bignumber.js";

export const satFactor = 100_000_000;

export const denominations = {
    sat: "sat",
    btc: "btc",
};

export const formatAmount = (amount, fixed = false) => {
    switch (denomination()) {
        case denominations.btc:
            let amountBig = new BigNumber(amount).div(satFactor);
            if (fixed) {
                return amountBig.toFixed(8);
            }
            return amountBig.toNumber();
        case denominations.sat:
            return amount;
    }
};

export const convertAmount = (amount) => {
    switch (denomination()) {
        case denominations.btc:
            let amountBig = new BigNumber(amount).multipliedBy(satFactor);
            return amountBig.toNumber();
        case denominations.sat:
            return amount;
    }
};
