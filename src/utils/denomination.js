import { denomination } from "../signals";

export const satFactor = 100_000_000;

export const denominations = {
    sat: "sat",
    btc: "btc",
};

export const formatAmount = (amount, fixed = false) => {
    switch (denomination()) {
        case denominations.btc:
            if (fixed) {
                return (amount / satFactor).toFixed(8);
            } else {
                return amount / satFactor;
            }
        case denominations.sat:
            return Math.ceil(amount);
    }
};

export const convertAmount = (amount) => {
    switch (denomination()) {
        case denominations.btc:
            return Math.ceil(amount * satFactor);
        case denominations.sat:
            return amount;
    }
};
