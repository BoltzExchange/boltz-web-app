import { isAddress } from "ethers";

import { config } from "../config";
import { AssetKind } from "../consts/AssetKind";

const normalizeAddress = (address: string) => {
    const trimmed = address.trim();
    return isAddress(trimmed) ? trimmed.toLowerCase() : trimmed;
};

export const isKnownTokenAddress = (
    asset: string,
    address: string,
): boolean => {
    if (config.assets?.[asset]?.type !== AssetKind.ERC20) {
        return false;
    }

    const normalizedAddress = normalizeAddress(address);
    if (normalizedAddress === "") {
        return false;
    }

    return Object.values(config.assets ?? {}).some(
        (candidateConfig) =>
            candidateConfig.type === AssetKind.ERC20 &&
            candidateConfig.token?.address !== undefined &&
            normalizeAddress(candidateConfig.token.address) ===
                normalizedAddress,
    );
};
