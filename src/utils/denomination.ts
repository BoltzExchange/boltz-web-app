import { BigNumber } from "bignumber.js";
import { assetAmountToSats } from "boltz-swaps/evm";
import { AssetKind } from "boltz-swaps/types";

import { config } from "../config";
import {
    LN,
    WBTC,
    getAssetDisplaySymbol,
    isBridgeAsset,
} from "../consts/Assets";
import { Denomination } from "../consts/Enums";

const miliFactor = 1_000;
const satDecimals = 8;
const satFactor = 100_000_000;

type LogAmount = BigNumber | bigint | number | string;

export const getValidationRegex = (maximum: number): RegExp => {
    const digits = maximum.toString().length;
    const firstDigit = BigNumber(maximum).div(satFactor).toString().charAt(0);
    const firstDigitRegex = firstDigit === "0" ? `0` : `0-${firstDigit}`;
    const regex = `^[0-9]{1,${digits}}$|^[${firstDigitRegex}]((\\.|,)[0-9]{1,8}){0,1}$`;
    return new RegExp(regex);
};

export const getDecimals = (asset: string) => {
    const assetConfig = config.assets?.[asset];

    const usesTokenUnits =
        asset !== WBTC &&
        assetConfig?.type === AssetKind.ERC20 &&
        (assetConfig?.token?.routeVia !== undefined || isBridgeAsset(asset));

    return {
        isErc20: usesTokenUnits,
        decimals: usesTokenUnits
            ? (assetConfig?.token?.decimals ?? satDecimals)
            : satDecimals,
    };
};

export const formatAmount = (
    amount: BigNumber,
    denomination: Denomination,
    separator: string,
    asset: string,
    fixed: boolean = false,
): string => {
    return formatAmountDenomination(
        amount,
        denomination,
        separator,
        asset,
        fixed,
    );
};

export const formatAmountDenomination = (
    amount: BigNumber,
    denomination: Denomination,
    separator: string,
    asset: string,
    fixed: boolean = false,
): string => {
    const { isErc20, decimals } = getDecimals(asset);

    if (denomination === Denomination.Btc || isErc20) {
        const amountBig = amount.div(
            isErc20 ? BigNumber(10).pow(decimals) : satFactor,
        );

        let amountString = amountBig.toString();
        if (fixed) {
            amountString = amountBig.toFixed(decimals);
            return amountString;
        }
        if (amountBig.isZero()) {
            amountString = amountBig.toFixed(1);
        }

        // Handle scientific notation (e.g., 0.00000001.toString() returns "1e-8")
        if (amountBig.toString().indexOf("-") !== -1) {
            amountString = amountBig
                .toFixed(Number(decimals))
                .replace(/0+$/, "");
        }

        if (separator === ",") {
            amountString = amountString.replace(".", ",");
        }

        return amountString;
    } else {
        const chars = amount.toString().split("").reverse();
        const formatted = chars
            .reduce(
                (acc, char, i) => (i % 3 === 0 ? acc + " " + char : acc + char),
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
};

export const formatDenomination = (denom: Denomination, asset: string) => {
    const { isErc20 } = getDecimals(asset);
    if (isErc20) {
        return getAssetDisplaySymbol(asset);
    }
    return denom === Denomination.Sat ? "sats" : getAssetDisplaySymbol(asset);
};

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

export const baseAssetAmountToInternal = (asset: string, amount: bigint) =>
    getDecimals(asset).isErc20
        ? BigNumber(amount.toString())
        : BigNumber(assetAmountToSats(amount, asset).toString());

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

// On-chain amount in the asset's smallest unit (ERC20 base units, wei or sats).
export const formatAssetAmountForLog = (
    amount: LogAmount,
    asset: string,
): string => {
    try {
        const assetConfig = config.assets?.[asset];
        if (asset === LN || assetConfig?.type === AssetKind.UTXO) {
            return `${amount.toString()} sats`;
        }

        const decimals =
            assetConfig?.type === AssetKind.EVMNative
                ? assetConfig.network?.nativeCurrency?.decimals
                : assetConfig?.token?.decimals;
        if (decimals === undefined) {
            throw new Error(`missing decimals for ${asset}`);
        }

        const formatted = BigNumber(amount.toString()).div(
            BigNumber(10).pow(decimals),
        );
        return `${formatted.toFixed()} ${getAssetDisplaySymbol(asset)}`;
    } catch {
        // Logging must never throw; fall back to the raw amount.
        return `${amount.toString()} ${asset}`;
    }
};

// Amount in the network's native gas currency (wei).
export const formatNativeAmountForLog = (
    amount: LogAmount,
    asset: string,
): string => {
    try {
        const nativeCurrency = config.assets?.[asset]?.network?.nativeCurrency;
        if (nativeCurrency?.decimals === undefined) {
            throw new Error(`missing native decimals for ${asset}`);
        }

        const formatted = BigNumber(amount.toString()).div(
            BigNumber(10).pow(nativeCurrency.decimals),
        );
        return `${formatted.toFixed()} ${nativeCurrency.symbol}`;
    } catch {
        return `${amount.toString()} ${asset}`;
    }
};

// Boltz swap-denomination amount: sats for BTC-pegged assets (incl. RBTC),
// token units for ERC20. RBTC differs from formatAssetAmountForLog, which uses
// on-chain wei.
export const formatSwapAmountForLog = (
    amount: LogAmount,
    asset: string,
): string => {
    try {
        const { isErc20, decimals } = getDecimals(asset);
        const value = BigNumber(amount.toString());
        const formatted = isErc20
            ? value.div(BigNumber(10).pow(decimals))
            : value;
        return `${formatted.toFixed()} ${formatDenomination(
            Denomination.Sat,
            asset,
        )}`;
    } catch {
        return `${amount.toString()} ${asset}`;
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
