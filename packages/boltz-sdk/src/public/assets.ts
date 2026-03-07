import { getConfig } from "./config";
import { AssetKind } from "./enums";

/** Lightning Network pseudo-asset identifier. */
export const LN = "LN";
/** Bitcoin mainchain. */
export const BTC = "BTC";
/** Liquid Network. */
export const LBTC = "L-BTC";
/** RSK (Rootstock) sidechain. */
export const RBTC = "RBTC";

/** Union of all known asset identifier string literals. */
export type AssetType = typeof LN | typeof BTC | typeof LBTC | typeof RBTC;

/** Asset types that support on-chain refund transactions. */
export type RefundableAssetType = typeof BTC | typeof LBTC | typeof RBTC;

/** All known asset identifiers. */
export const assets = [LN, BTC, LBTC, RBTC];

/** Assets that support on-chain refund paths. */
export const refundableAssets = [BTC, LBTC, RBTC];

/** UTXO-based chain assets. */
export const btcChains = [BTC, LBTC];

/** EVM-based chain assets. */
export const evmChains = [RBTC];

/**
 * Check whether an asset is on an EVM chain.
 *
 * @param asset - Asset identifier to check.
 * @returns `true` if the asset is configured as {@link AssetKind.EVMNative} or {@link AssetKind.ERC20}.
 */
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
