import { isAddress } from "ethers/address";

import { config } from "../config";
import { isStablecoinAsset } from "../consts/Assets";

const normalizeAddress = (address: string) => {
    const trimmed = address.trim();
    return isAddress(trimmed) ? trimmed.toLowerCase() : trimmed;
};

export const isKnownStablecoinTokenAddress = (
    asset: string,
    address: string,
): boolean => {
    if (!isStablecoinAsset(asset)) {
        return false;
    }

    const normalizedAddress = normalizeAddress(address);
    if (normalizedAddress === "") {
        return false;
    }

    return Object.entries(config.assets ?? {}).some(
        ([candidateAsset, candidateConfig]) =>
            isStablecoinAsset(candidateAsset) &&
            candidateConfig.token?.address !== undefined &&
            normalizeAddress(candidateConfig.token.address) ===
                normalizedAddress,
    );
};
