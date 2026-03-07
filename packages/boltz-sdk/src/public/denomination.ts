import { BigNumber } from "bignumber.js";

import { getConfig } from "./config";
import { AssetKind, Denomination } from "./enums";

/** Satoshi multiplier (1 BTC = 100 000 000 sat). */
const satFactor = 100_000_000;
const satDecimals = 8;

/**
 * Get the decimal precision for an asset.
 *
 * For routed ERC-20 tokens, returns the token's decimal count;
 * for all other assets, returns 8 (satoshi precision).
 *
 * @param asset - Asset identifier.
 */
export const getDecimals = (asset: string) => {
    const assetConfig = getConfig().assets?.[asset];

    const isRoutedErc20 =
        assetConfig?.type === AssetKind.ERC20 &&
        assetConfig?.token?.routeVia !== undefined;

    return {
        isErc20: isRoutedErc20,
        decimals: isRoutedErc20
            ? (assetConfig?.token?.decimals ?? satDecimals)
            : satDecimals,
    };
};

/**
 * Convert an amount from a given denomination to its base unit.
 *
 * @param asset - Asset identifier (used to look up ERC-20 decimals).
 * @param amount - The amount in the source denomination.
 * @param denom - The source denomination (e.g. `"btc"` or `"sat"`).
 * @returns The equivalent amount in the asset's base unit.
 */
export const convertAmount = (
    asset: string,
    amount: BigNumber,
    denom: string,
): BigNumber => {
    const { isErc20, decimals } = getDecimals(asset);

    if (isErc20 || denom === Denomination.Btc) {
        return amount.multipliedBy(BigNumber(10).pow(decimals));
    } else {
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
