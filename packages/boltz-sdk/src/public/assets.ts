import { getConfig } from "./config";
import { AssetKind } from "./enums";

export const LN = "LN";
export const BTC = "BTC";
export const LBTC = "L-BTC";
export const RBTC = "RBTC";

export type AssetType = typeof LN | typeof BTC | typeof LBTC | typeof RBTC;
export type RefundableAssetType = typeof BTC | typeof LBTC | typeof RBTC;

export const assets = [LN, BTC, LBTC, RBTC];

export const refundableAssets = [BTC, LBTC, RBTC];

export const btcChains = [BTC, LBTC];

export const evmChains = [RBTC];

export const isEvmAsset = (asset: string): boolean => {
    const assetConfig = getConfig().assets?.[asset];
    if (!assetConfig) {
        return false;
    }

    return (
        assetConfig.type === AssetKind.EVMNative ||
        assetConfig.type === AssetKind.ERC20
    );
};
