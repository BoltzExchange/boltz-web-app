import {
    type AssetBridge,
    AssetKind,
    BridgeKind,
    NetworkTransport,
    Usdt0Kind,
} from "boltz-swaps/types";

import { config } from "../config";

export const LN = "LN";
export const BTC = "BTC";
export const LBTC = "L-BTC";
export const LUSDT = "L-USDt";
export const RBTC = "RBTC";
export const TBTC = "TBTC";
export const WBTC = "WBTC";
export const USDT0 = "USDT0";
export const USDC = "USDC";
export const ETH = "ETH";

export type AssetType =
    | typeof LN
    | typeof BTC
    | typeof LBTC
    | typeof LUSDT
    | typeof RBTC
    | typeof TBTC
    | typeof WBTC
    | typeof USDT0
    | typeof USDC;

export type RefundableAssetType =
    | typeof BTC
    | typeof LBTC
    | typeof RBTC
    | typeof TBTC;

export type blockChainsAssets =
    | typeof BTC
    | typeof LBTC
    | typeof RBTC
    | typeof ETH;

const assetDisplayOrder: string[] = [
    LN,
    BTC,
    LBTC,
    RBTC,
    TBTC,
    WBTC,
    USDT0,
    USDC,
];

export const assets: string[] = [
    ...assetDisplayOrder.filter(
        (asset) => asset === LN || asset in (config.assets ?? {}),
    ),
    ...Object.keys(config.assets ?? {}).filter(
        (asset) => !assetDisplayOrder.includes(asset),
    ),
];

export const refundableAssets = [BTC, LBTC, RBTC, TBTC];

export const btcChains = [BTC, LBTC];

export const evmChains = [RBTC, TBTC, WBTC, USDT0, USDC];

const networkBadgeAliases: Record<string, string> = {
    "Arbitrum One": "arbitrum",
    "Conflux eSpace": "conflux",
    "Polygon PoS": "polygon",
};

// Canonical assets that are USD stablecoins. Their base-unit → USD conversion
// is a simple power-of-ten, not a market-rate lookup. When a new stablecoin
// bridge (e.g. USDC via CCTP) is added, include its canonical here.
const stablecoinCanonicals = new Set<string>([LUSDT, USDT0, USDC]);

export const isStablecoinAsset = (asset: string): boolean => {
    if (stablecoinCanonicals.has(asset)) {
        return true;
    }
    const canonical = getAssetBridge(asset)?.canonicalAsset;
    return canonical !== undefined && stablecoinCanonicals.has(canonical);
};

export const getAssetBridge = (asset: string): AssetBridge | undefined =>
    config.assets?.[asset]?.bridge;

export const getBridgeKind = (asset: string): BridgeKind | undefined =>
    getAssetBridge(asset)?.kind;

// Any asset that participates in a bridge (canonical hub or chain-specific variant).
export const isBridgeAsset = (asset: string): boolean =>
    getAssetBridge(asset) !== undefined;

// The canonical (hub) asset of a bridge family — i.e. `bridge.canonicalAsset === asset`.
export const isBridgeCanonicalAsset = (asset: string): boolean =>
    getAssetBridge(asset)?.canonicalAsset === asset;

// A chain-specific variant of a bridge family — i.e. bridged but not the canonical.
export const isBridgeVariant = (asset: string): boolean => {
    const bridge = getAssetBridge(asset);
    return bridge !== undefined && bridge.canonicalAsset !== asset;
};

// All variants (excluding the canonical itself) whose bridge.canonicalAsset === canonical.
export const getBridgeVariants = (canonical: string): string[] =>
    Object.keys(config.assets ?? {}).filter(
        (asset) =>
            asset !== canonical &&
            getAssetBridge(asset)?.canonicalAsset === canonical,
    );

export const getNetworkTransport = (
    asset?: string,
): NetworkTransport | undefined => {
    return asset === undefined
        ? undefined
        : config.assets?.[asset]?.network?.transport;
};

const getAssetConfig = (asset: string) => config.assets?.[asset];

export const getCanonicalAsset = (asset: string): string =>
    getAssetBridge(asset)?.canonicalAsset ?? asset;

const getCanonicalAssetConfig = (asset: string) =>
    getAssetConfig(getCanonicalAsset(asset));

export const getRouteViaAsset = (asset: string): string | undefined =>
    getAssetConfig(asset)?.token?.routeVia ??
    getAssetConfig(asset)?.liquidToken?.routeVia ??
    getCanonicalAssetConfig(asset)?.token?.routeVia ??
    getCanonicalAssetConfig(asset)?.liquidToken?.routeVia;

export const getBridgeMesh = (from: string, to?: string): Usdt0Kind => {
    const meshKinds = [from, to]
        .filter((candidate): candidate is string => candidate !== undefined)
        .map((candidate) => {
            const bridge = config.assets?.[candidate]?.bridge;
            if (bridge === undefined) {
                return Usdt0Kind.Native;
            }

            if (bridge.kind !== BridgeKind.Oft) {
                throw new Error(
                    `getBridgeMesh requires OFT bridge assets; ${candidate} uses ${bridge.kind}`,
                );
            }

            return bridge.oft?.mesh ?? Usdt0Kind.Native;
        });

    return meshKinds.includes(Usdt0Kind.Legacy)
        ? Usdt0Kind.Legacy
        : Usdt0Kind.Native;
};

const assetDisplaySymbols: Record<string, string> = {
    [LBTC]: "LBTC",
    [LUSDT]: "USDT",
    [USDT0]: "USDT",
};

export const getAssetDisplaySymbol = (asset: string): string => {
    const canonicalAsset = getCanonicalAsset(asset);
    return assetDisplaySymbols[canonicalAsset] ?? canonicalAsset;
};

const assetPickerNetworkVariantCanonicals: Record<string, string> = {
    [LUSDT]: USDT0,
};

export const isAssetPickerNetworkVariant = (asset: string): boolean => {
    const canonical = assetPickerNetworkVariantCanonicals[asset];
    return canonical !== undefined && config.assets?.[canonical] !== undefined;
};

export const getAssetPickerCanonical = (asset: string): string => {
    const bridgeCanonical = getAssetBridge(asset)?.canonicalAsset;
    if (bridgeCanonical !== undefined) {
        return bridgeCanonical;
    }

    return isAssetPickerNetworkVariant(asset)
        ? assetPickerNetworkVariantCanonicals[asset]
        : asset;
};

export const getAssetPickerNetworkVariants = (canonical: string): string[] => [
    ...getBridgeVariants(canonical),
    ...Object.entries(assetPickerNetworkVariantCanonicals)
        .filter(
            ([asset, variantCanonical]) =>
                variantCanonical === canonical &&
                config.assets?.[asset] !== undefined,
        )
        .map(([asset]) => asset),
];

export const hasAssetPickerNetworkVariants = (asset: string): boolean =>
    getAssetPickerNetworkVariants(asset).length > 0;

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

export const isLiquidAsset = (asset: string): boolean =>
    asset === LBTC || asset === LUSDT || isLiquidTokenAsset(asset);

export const isLiquidTokenAsset = (asset: string): boolean => {
    const assetConfig = config.assets?.[asset];
    return assetConfig?.type === AssetKind.LiquidToken;
};

export const isEvmAsset = (asset: string): boolean => {
    const assetConfig = config.assets?.[asset];
    if (!assetConfig) {
        return false;
    }

    if (assetConfig.type === AssetKind.EVMNative) {
        return true;
    }

    return (
        assetConfig.type === AssetKind.ERC20 &&
        getNetworkTransport(asset) === NetworkTransport.Evm
    );
};

export const isWalletConnectableAsset = (asset: string): boolean => {
    const transport = getNetworkTransport(asset);
    return (
        transport === NetworkTransport.Evm ||
        transport === NetworkTransport.Solana ||
        transport === NetworkTransport.Tron
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

export const requireChainId = (asset: string): number => {
    const chainId = config.assets?.[asset]?.network?.chainId;
    if (chainId === undefined) {
        throw new Error(`missing chainId for asset: ${asset}`);
    }
    return chainId;
};

export const getAssetNetwork = (asset: string): string | null => {
    switch (asset) {
        case BTC:
            return "Bitcoin";
        case LN:
            return "Lightning";
        case LBTC:
        case LUSDT:
            return "Liquid";
        default:
            return config.assets?.[asset]?.network?.chainName ?? null;
    }
};

export const getNetworkBadge = (asset: string): string | null => {
    if (isLiquidTokenAsset(asset)) {
        return "liquid";
    }

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
    const assetConfig = getAssetConfig(asset);
    if (!assetConfig) {
        return undefined;
    }

    // Bridge variants inherit route metadata from their canonical asset.
    const routeVia = getRouteViaAsset(asset);
    if (routeVia) {
        const routeViaConfig = getAssetConfig(routeVia);
        return routeViaConfig?.contracts?.router;
    }

    return (
        assetConfig.contracts?.router ??
        getCanonicalAssetConfig(asset)?.contracts?.router
    );
};

export const requireRouterAddress = (asset: string): string => {
    const routerAddress = getRouterAddress(asset);
    if (!routerAddress) {
        throw new Error(`Asset ${asset} has no router configured`);
    }
    return routerAddress;
};
