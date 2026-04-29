import log from "loglevel";

import {
    type Usdt0VariantAsset,
    usdt0EnvByAsset,
    usdt0Variants,
} from "../configs/usdt0";

const envOftEtaSeconds = (asset: Usdt0VariantAsset): number | undefined => {
    const envValue = usdt0EnvByAsset[asset];
    if (envValue === undefined || envValue.trim() === "") {
        return undefined;
    }

    const seconds = Number(envValue);
    if (!Number.isFinite(seconds) || seconds < 0) {
        log.warn(`Invalid OFT ETA value for ${asset}: ${envValue}`);
        return undefined;
    }

    return seconds;
};

const preOftEtaSecondsToUsdt0 = Object.fromEntries(
    usdt0Variants.map((variant) => [
        variant.asset,
        envOftEtaSeconds(variant.asset),
    ]),
) as Record<Usdt0VariantAsset, number | undefined>;

log.info("OFT ETA values", preOftEtaSecondsToUsdt0);

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
