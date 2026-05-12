import { isAddress } from "viem";

import { getBoltzSwapsConfig } from "../config.ts";
import { AssetKind } from "../types.ts";

const normalizeAddress = (address: string) => {
    const trimmed = address.trim();
    return isAddress(trimmed, { strict: false })
        ? trimmed.toLowerCase()
        : trimmed;
};

export const isKnownTokenAddress = (
    asset: string,
    address: string,
): boolean => {
    const assets = getBoltzSwapsConfig().assets;
    if (assets?.[asset]?.type !== AssetKind.ERC20) {
        return false;
    }

    const normalizedAddress = normalizeAddress(address);
    if (normalizedAddress === "") {
        return false;
    }

    return Object.values(assets ?? {}).some(
        (candidateConfig) =>
            candidateConfig.type === AssetKind.ERC20 &&
            candidateConfig.token?.address !== undefined &&
            normalizeAddress(candidateConfig.token.address) ===
                normalizedAddress,
    );
};
