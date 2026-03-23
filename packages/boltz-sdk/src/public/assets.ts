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
/** TBTC ERC-20 token. */
export const TBTC = "TBTC";
/** USDT0 stablecoin token. */
export const USDT0 = "USDT0";
/** Prefix used for USDT0 chain variants (e.g. `"USDT0-arbitrum"`). */
export const USDT0_VARIANT_PREFIX = `${USDT0}-`;

/** Union of all known asset identifier string literals. */
export type AssetType =
    | typeof LN
    | typeof BTC
    | typeof LBTC
    | typeof RBTC
    | typeof TBTC
    | typeof USDT0;

/** Asset types that support on-chain refund transactions. */
export type RefundableAssetType = typeof BTC | typeof LBTC | typeof RBTC;

/** Preferred display ordering for asset lists. */
const assetDisplayOrder: string[] = [LN, BTC, LBTC, RBTC, TBTC, USDT0];

const getAssetsConfig = () => {
    try {
        return getConfig().assets;
    } catch {
        return undefined;
    }
};

/**
 * Get all known asset identifiers, built dynamically from the SDK configuration.
 *
 * Preserves the canonical display order and appends any extra assets
 * found in the config that are not in the default list.
 */
export const getAssets = (): string[] => {
    const cfg = getAssetsConfig();

    return [
        ...assetDisplayOrder.filter(
            (asset) => asset === LN || (cfg && asset in cfg),
        ),
        ...Object.keys(cfg ?? {}).filter(
            (asset) => !assetDisplayOrder.includes(asset),
        ),
    ];
};

/**
 * @deprecated Use {@link getAssets} for dynamic configuration support.
 * This static array only contains the default assets and does not
 * reflect the SDK configuration.
 */
export const assets = [LN, BTC, LBTC, RBTC];

/** Assets that support on-chain refund paths. */
export const refundableAssets = [BTC, LBTC, RBTC];

/** UTXO-based chain assets. */
export const btcChains = [BTC, LBTC];

/**
 * Get EVM-based chain assets, built dynamically from the SDK configuration.
 */
export const getEvmChains = (): string[] => {
    const cfg = getAssetsConfig();

    if (!cfg) {
        return [RBTC];
    }

    return Object.keys(cfg).filter((asset) => {
        const t = cfg[asset]?.type;
        return t === AssetKind.EVMNative || t === AssetKind.ERC20;
    });
};

/**
 * @deprecated Use {@link getEvmChains} for dynamic configuration support.
 * This static array only contains RBTC and does not reflect the SDK configuration.
 */
export const evmChains = [RBTC];

/** Check whether an asset string is a USDT0 chain variant (e.g. `"USDT0-arbitrum"`). */
export const isUsdt0Variant = (asset: string): boolean =>
    asset.startsWith(USDT0_VARIANT_PREFIX);

/** Check whether an asset is USDT0 or one of its chain variants. */
export const isUsdt0Asset = (asset: string): boolean =>
    asset === USDT0 || isUsdt0Variant(asset);

/** Map Lightning pseudo-asset to on-chain ticker used in pair lookups. */
export const coalesceLn = (asset: string): string =>
    asset === LN ? BTC : asset;

/** Resolve USDT0 chain variants to the canonical `"USDT0"` symbol. */
export const getCanonicalAsset = (asset: string): string =>
    isUsdt0Variant(asset) ? USDT0 : asset;

/** Return configured {@link AssetKind} or {@link AssetKind.UTXO} if unknown. */
export const getKindForAsset = (asset: string): AssetKind => {
    const assetConfig = getConfig().assets?.[asset];
    if (!assetConfig) {
        return AssetKind.UTXO;
    }
    return assetConfig.type;
};

export const hasTokenConfig = (
    asset: string,
): { address: string; decimals: number } | undefined => {
    const assetConfig = getConfig().assets?.[asset];
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

export const getTokenDecimals = (asset: string): number =>
    requireTokenConfig(asset).decimals;

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
