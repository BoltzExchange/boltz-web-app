import { Denomination } from "./enums";

/** Satoshi multiplier (1 BTC = 100 000 000 sat). */
const satFactor = 100_000_000;

/**
 * Convert an amount from a given denomination to satoshis.
 *
 * @param amount - The amount in the source denomination.
 * @param denom - The source denomination (e.g. `"btc"` or `"sat"`).
 * @returns The equivalent amount in satoshis.
 */
export const convertAmount = (amount: BigNumber, denom: string): BigNumber => {
    switch (denom) {
        case Denomination.Btc:
            return amount.multipliedBy(satFactor);
        default:
            return amount;
    }
};

/**
 * Convert a BTC amount to satoshis.
 *
 * @param btc - Amount in BTC.
 * @returns Equivalent amount in satoshis.
 */
export const btcToSat = (btc: BigNumber) => {
    return btc.multipliedBy(satFactor);
};

/**
 * Convert a satoshi amount to BTC.
 *
 * @param sat - Amount in satoshis.
 * @returns Equivalent amount in BTC.
 */
export const satToBtc = (sat: BigNumber) => {
    return sat.dividedBy(satFactor);
};
