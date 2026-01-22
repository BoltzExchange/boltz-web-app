import { config } from "../config";
import { AssetKind } from "./AssetKind";

export { AssetKind };

export const LN = "LN";
export const BTC = "BTC";
export const LBTC = "L-BTC";
export const RBTC = "RBTC";
export const TBTC = "TBTC";
export const USDT0 = "USDT0";

export type AssetType =
    | typeof LN
    | typeof BTC
    | typeof LBTC
    | typeof RBTC
    | typeof TBTC
    | typeof USDT0;

export type RefundableAssetType = typeof BTC | typeof LBTC | typeof RBTC;

export const assets = [LN, BTC, LBTC, RBTC, TBTC, USDT0];

export const refundableAssets = [BTC, LBTC, RBTC];

export const btcChains = [BTC, LBTC];

export const evmChains = [RBTC];

export const getKindForAsset = (asset: string): AssetKind => {
    const assetConfig = config.assets?.[asset];
    if (!assetConfig) {
        return AssetKind.UTXO;
    }

    return assetConfig.type;
};

export const isEvmAsset = (asset: string): boolean => {
    const assetConfig = config.assets?.[asset];
    if (!assetConfig) {
        return false;
    }

    return (
        assetConfig.type === AssetKind.EVMNative ||
        assetConfig.type === AssetKind.ERC20
    );
};

export const getEvmAssets = (): string[] => {
    if (!config.assets) {
        return [];
    }

    return Object.keys(config.assets).filter(isEvmAsset);
};

export const hasEvmAssets = (): boolean => {
    return getEvmAssets().length > 0;
};

export const getTokenAddress = (asset: string): string | undefined => {
    return requireTokenConfig(asset).address;
};

export const getTokenDecimals = (asset: string): number => {
    return requireTokenConfig(asset).decimals;
};

export const hasTokenConfig = (
    asset: string,
): { address: string; decimals: number } | undefined => {
    const assetConfig = config.assets?.[asset];
    if (!assetConfig || assetConfig.type !== AssetKind.ERC20) {
        return undefined;
    }

    const token = assetConfig.token;
    if (!token?.address || token.decimals === undefined) {
        return undefined;
    }

    return { address: token.address, decimals: token.decimals };
};

export const requireTokenConfig = (
    asset: string,
): { address: string; decimals: number } => {
    const tokenConfig = hasTokenConfig(asset);
    if (!tokenConfig) {
        throw new Error(
            `Asset ${asset} is missing required ERC20 token configuration`,
        );
    }
    return tokenConfig;
};

export const getNetworkBadge = (asset: string): string | null => {
    const chainName = config.assets?.[asset]?.network?.chainName;

    if (!chainName) {
        return null;
    }

    return chainName.toLowerCase();
};

export const getRouterAddress = (asset: string): string | undefined => {
    const assetConfig = config.assets?.[asset];
    if (!assetConfig) {
        return undefined;
    }

    // If this asset routes via another asset, get that asset's router
    if (assetConfig.token?.routeVia) {
        const routeViaConfig = config.assets?.[assetConfig.token.routeVia];
        return routeViaConfig?.contracts?.router;
    }

    return assetConfig.contracts?.router;
};

export const requireRouterAddress = (asset: string): string => {
    const routerAddress = getRouterAddress(asset);
    if (!routerAddress) {
        throw new Error(`Asset ${asset} has no router configured`);
    }
    return routerAddress;
};
