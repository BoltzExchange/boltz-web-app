import { config } from "../config";
import { AssetKind } from "./AssetKind";

export { AssetKind };

export const LN = "LN";
export const BTC = "BTC";
export const LBTC = "L-BTC";
export const RBTC = "RBTC";
export const TBTC = "TBTC";
export const USDT0 = "USDT0";
export const USDT0_VARIANT_PREFIX = `${USDT0}-`;

export type AssetType =
    | typeof LN
    | typeof BTC
    | typeof LBTC
    | typeof RBTC
    | typeof TBTC
    | typeof USDT0;

export type RefundableAssetType = typeof BTC | typeof LBTC | typeof RBTC;

const assetDisplayOrder: string[] = [LN, BTC, LBTC, RBTC, TBTC, USDT0];

export const assets: string[] = [
    ...assetDisplayOrder.filter(
        (asset) => asset === LN || asset in (config.assets ?? {}),
    ),
    ...Object.keys(config.assets ?? {}).filter(
        (asset) => !assetDisplayOrder.includes(asset),
    ),
];

export const refundableAssets = [BTC, LBTC, RBTC];

export const btcChains = [BTC, LBTC];

export const evmChains = [RBTC, TBTC, USDT0];

const networkBadgeAliases: Record<string, string> = {
    "Arbitrum One": "arbitrum",
    "Conflux eSpace": "conflux",
    "Polygon PoS": "polygon",
};

export const isUsdt0Variant = (asset: string): boolean =>
    asset.startsWith(USDT0_VARIANT_PREFIX);

export const isUsdt0Asset = (asset: string): boolean =>
    asset === USDT0 || isUsdt0Variant(asset);

export const getCanonicalAsset = (asset: string): string =>
    isUsdt0Variant(asset) ? USDT0 : asset;

const assetDisplaySymbols: Record<string, string> = {
    [LBTC]: "LBTC",
    [USDT0]: "USDT",
};

export const getAssetDisplaySymbol = (asset: string): string => {
    const canonicalAsset = getCanonicalAsset(asset);
    return assetDisplaySymbols[canonicalAsset] ?? canonicalAsset;
};

const normalizeNetworkBadge = (chainName: string): string =>
    networkBadgeAliases[chainName] ??
    chainName.toLowerCase().replace(/\s+/g, "");

export const isBitcoinOnlyAsset = (asset: string): boolean =>
    asset === LN || asset === BTC;

export const isBitcoinOnlyPair = (
    fromAsset: string,
    toAsset: string,
): boolean =>
    isBitcoinOnlyAsset(fromAsset) &&
    isBitcoinOnlyAsset(toAsset) &&
    fromAsset !== toAsset;

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

export const getTokenAddress = (asset: string): string => {
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

export const getAssetNetwork = (asset: string): string | null => {
    switch (asset) {
        case BTC:
            return "Bitcoin";
        case LN:
            return "Lightning";
        case LBTC:
            return "Liquid";
        default:
            return config.assets?.[asset]?.network?.chainName ?? null;
    }
};

export const getNetworkBadge = (asset: string): string | null => {
    // avoid network badge on native assets like RBTC
    if (getKindForAsset(asset) !== AssetKind.ERC20) {
        return null;
    }

    const chainName = config.assets?.[asset]?.network?.chainName;

    if (!chainName) {
        return null;
    }

    return normalizeNetworkBadge(chainName);
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
