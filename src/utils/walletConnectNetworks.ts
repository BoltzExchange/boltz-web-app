// eslint-disable-next-line no-restricted-imports
import type { AppKitNetwork } from "@reown/appkit/networks";
import log from "loglevel";

import type { Asset } from "../configs/base";

type ValidatedAsset = Asset &
    Required<Pick<Asset, "network" | "blockExplorerUrl">>;

const validateAssetConfig = (
    assetsConfig: Record<string, Asset> | undefined,
    asset: string,
): ValidatedAsset | undefined => {
    const assetConfig = assetsConfig?.[asset];
    if (!assetConfig) {
        log.warn(`WalletConnect: skipping ${asset} - missing asset config`);
        return undefined;
    }

    if (!assetConfig.network) {
        log.warn(`WalletConnect: skipping ${asset} - missing network config`);
        return undefined;
    }

    if (!assetConfig.network.rpcUrls?.length) {
        log.warn(`WalletConnect: skipping ${asset} - missing rpc urls`);
        return undefined;
    }

    if (!assetConfig.blockExplorerUrl?.normal) {
        log.warn(
            `WalletConnect: skipping ${asset} - missing block explorer url`,
        );
        return undefined;
    }

    return assetConfig as ValidatedAsset;
};

export const buildWalletConnectNetworks = (
    assetsConfig: Record<string, Asset> | undefined,
    supportedAssets: readonly string[],
): [AppKitNetwork, ...AppKitNetwork[]] => {
    const networks: AppKitNetwork[] = [];

    for (const asset of supportedAssets) {
        const assetConfig = validateAssetConfig(assetsConfig, asset);
        if (!assetConfig) {
            continue;
        }

        const network = assetConfig.network;

        if (networks.some((n) => n.id === network.chainId)) {
            continue;
        }

        networks.push({
            id: network.chainId,
            name: network.chainName,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: {
                default: {
                    http: network.rpcUrls,
                },
            },
            blockExplorers: {
                default: {
                    name: "Explorer",
                    url: assetConfig.blockExplorerUrl.normal,
                },
            },
        });
    }

    if (networks.length === 0) {
        throw new Error(
            "WalletConnect config validation failed: no supported networks configured",
        );
    }

    return networks as [AppKitNetwork, ...AppKitNetwork[]];
};
