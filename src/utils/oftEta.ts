import type { Usdt0VariantAsset } from "../configs/mainnet";

const preOftEtaSecondsToUsdt0: Record<Usdt0VariantAsset, number | undefined> = {
    "USDT0-BERA": 2 * 60 + 11,
    "USDT0-CFX": 58 * 60 + 18,
    "USDT0-CORN": 25 * 60 * 60,
    "USDT0-ETH": 3 * 60 + 24,
    "USDT0-FLR": 15 * 60 + 49,
    "USDT0-HBAR": 2 * 60 + 13,
    "USDT0-HYPE": 12 * 60 * 60,
    "USDT0-INK": 7 * 60 + 42,
    "USDT0-MEGAETH": 90 * 60,
    "USDT0-MNT": 67 * 60,
    "USDT0-MON": 24 * 60 + 17,
    "USDT0-MORPH": 55 * 60 + 28,
    "USDT0-OP": 15 * 60 + 13,
    "USDT0-PLASMA": 30 * 60 + 12,
    "USDT0-POL": 1 * 60 + 22,
    "USDT0-RBTC": 46 * 60 + 54,
    "USDT0-SEI": 16 * 60 + 36,
    "USDT0-SOL": 26,
    "USDT0-STABLE": 43 * 60 + 2,
    "USDT0-TEMPO": 27 * 60 + 8,
    "USDT0-TRON": 3 * 60 + 41,
    "USDT0-UNI": 7 * 60 + 42,
    "USDT0-XLAYER": 150 * 60,
};

const isUsdt0VariantAsset = (asset: string): asset is Usdt0VariantAsset =>
    asset in preOftEtaSecondsToUsdt0;

export const computeOftEtaSeconds = (
    sourceAsset: string,
    destinationAsset: string,
): number | undefined => {
    if (destinationAsset !== "USDT0") {
        return undefined;
    }
    if (!isUsdt0VariantAsset(sourceAsset)) {
        return undefined;
    }

    return preOftEtaSecondsToUsdt0[sourceAsset];
};
