import { denomination } from "../signals";

export const sat_factor = 100_000_000;

export const denominations = {
  sat: "sat",
  btc: "btc",
};

export const convertAmount = (amount, amountDenomination) => {
  if (denomination() === amountDenomination) {
    return amount;
  }

  switch (denomination()) {
    case denominations.btc: return amount / sat_factor;
    case denominations.sat: return Math.ceil(amount * sat_factor);
  }
}

export const formatAmount = (amount) => {
  switch (denomination()) {
    case denominations.btc: return amount.toFixed(8);
    case denominations.sat: return Math.ceil(amount); 
  }
};
