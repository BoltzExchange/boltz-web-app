import { config } from "../config";

export const LN = "LN";
export const BTC = "BTC";
export const LBTC = "L-BTC";
export const RBTC = "RBTC";
export const TBTC = "TBTC";

export type AssetType =
    | typeof LN
    | typeof BTC
    | typeof LBTC
    | typeof RBTC
    | typeof TBTC;

export type RefundableAssetType = typeof BTC | typeof LBTC;

export const assets = [LN, BTC, LBTC, RBTC, TBTC];

// RBTC is not refundable because its keys come from the user's wallet
export const refundableAssets = [BTC, LBTC];

export const enum AssetKind {
    UTXO = "UTXO",
    EVMNative = "EVM_NATIVE",
    ERC20 = "ERC20",
}

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
