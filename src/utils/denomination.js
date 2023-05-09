import { denomination } from "../signals";

export const satFactor = 100_000_000;

export const denominations = {
  sat: "sat",
  btc: "btc",
};

export const convertAmount = (amount, amountDenomination) => {
  if (denomination() === amountDenomination) {
    return amount;
  }

  switch (denomination()) {
    case denominations.btc: return amount / satFactor;
    case denominations.sat: return Math.ceil(amount * satFactor);
  }
}

export const formatAmount = (amount) => {
  switch (denomination()) {
    case denominations.btc: return amount.toFixed(8);
    case denominations.sat: return Math.ceil(amount); 
  }
};
