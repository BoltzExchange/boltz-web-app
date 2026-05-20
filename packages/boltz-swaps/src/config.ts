import {
    type Asset,
    type AssetBridge,
    AssetKind,
    BridgeKind,
    NetworkTransport,
    Usdt0Kind,
} from "./types.ts";

// Runtime configuration the host application injects so lib code (CCTP/OFT
// attestation, bridge drivers, chain helpers) can resolve asset metadata.
//
// The optional `A` parameter captures the host's asset-symbol union for
// type-safe SDK methods.
export interface BoltzSwapsConfig<A extends string = string> {
    assets: Record<A, Asset>;
    cctpApiUrl: string;
    solburnUrl: string;
    layerZeroExplorerUrl: string;
    cctpExplorerUrl: string;
    oftDeploymentsUrl: string;
    gasTopUpSupported: (asset: string) => boolean;
    getGasTopUpNativeAmount: (asset: string) => Promise<bigint>;
    // Resolved Boltz API base URL (post clearnet/onion switching). Lib's
    // `fetcher` reads this on every call so onion mode stays dynamic.
    boltzApiUrl: string;
    // Referral header value (e.g. "pro" / "boltz_webapp_mobile"). Read on
    // every request.
    referral?: string;

    // When true, cooperative-signature Boltz endpoints throw before sending.
    // Should only be used for testing
    cooperativeDisabled?: boolean;
}

// Loose input shape accepted by `setBoltzSwapsConfig` / `createBoltzClient`.
// Missing fields are filled in with `MAINNET_API_DEFAULTS` / no-op fallbacks.
export type BoltzSwapsConfigInput<A extends string = string> = Partial<
    BoltzSwapsConfig<A>
>;

// Mainnet defaults for the external service URLs that the SDK needs. Used by
// `setBoltzSwapsConfig` when the consumer omits a field, and by the mainnet
// preset as its default values.
export const MAINNET_API_DEFAULTS: {
    boltzApiUrl: string;
    cctpApiUrl: string;
    solburnUrl: string;
    cctpExplorerUrl: string;
    layerZeroExplorerUrl: string;
    oftDeploymentsUrl: string;
} = {
    boltzApiUrl: "https://api.boltz.exchange",
    cctpApiUrl: "https://iris-api.circle.com",
    solburnUrl: "https://solburn.ccxp.space",
    cctpExplorerUrl: "https://ccxp.space",
    layerZeroExplorerUrl: "https://layerzeroscan.com",
    oftDeploymentsUrl: "https://docs.usdt0.to/api/deployments",
};

const defaultGasTopUpSupported = (): boolean => false;
const defaultGetGasTopUpNativeAmount = (): Promise<bigint> =>
    Promise.resolve(0n);

const REQUIRED_DEFAULTS: Omit<
    BoltzSwapsConfig,
    "assets" | "referral" | "cooperativeDisabled"
> = {
    ...MAINNET_API_DEFAULTS,
    gasTopUpSupported: defaultGasTopUpSupported,
    getGasTopUpNativeAmount: defaultGetGasTopUpNativeAmount,
};

const defaultsAssets: Record<string, Asset> = {};

const requiredKeys: ReadonlyArray<keyof typeof REQUIRED_DEFAULTS> = [
    "boltzApiUrl",
    "cctpApiUrl",
    "solburnUrl",
    "cctpExplorerUrl",
    "layerZeroExplorerUrl",
    "oftDeploymentsUrl",
    "gasTopUpSupported",
    "getGasTopUpNativeAmount",
];

// Builds a getter-proxy so dynamic inputs (e.g. the lazy proxy created by
// `createBoltzClient`) stay dynamic — every property read re-resolves the
// underlying input and falls back to the default if undefined.
const mergeWithDefaults = <A extends string>(
    input: BoltzSwapsConfigInput<A>,
): BoltzSwapsConfig<A> => {
    const merged = {} as BoltzSwapsConfig<A>;
    Object.defineProperty(merged, "assets", {
        enumerable: true,
        get: () => input.assets ?? (defaultsAssets as Record<A, Asset>),
    });
    for (const key of requiredKeys) {
        Object.defineProperty(merged, key, {
            enumerable: true,
            get: () => input[key] ?? REQUIRED_DEFAULTS[key],
        });
    }
    for (const key of ["referral", "cooperativeDisabled"] as const) {
        Object.defineProperty(merged, key, {
            enumerable: true,
            get: () => input[key],
        });
    }
    return merged;
};

let active: BoltzSwapsConfig = mergeWithDefaults({});

export const setBoltzSwapsConfig = <A extends string = string>(
    config: BoltzSwapsConfigInput<A>,
): void => {
    active = mergeWithDefaults(config) as BoltzSwapsConfig;
};

export const getBoltzSwapsConfig = (): BoltzSwapsConfig => active;

const getAssetConfig = (asset: string): Asset | undefined =>
    getBoltzSwapsConfig().assets[asset];

export const getAssetBridge = (asset: string): AssetBridge | undefined =>
    getAssetConfig(asset)?.bridge;

export const getBridgeKind = (asset: string): BridgeKind | undefined =>
    getAssetBridge(asset)?.kind;

export const isBridgeAsset = (asset: string): boolean =>
    getAssetBridge(asset) !== undefined;

export const isBridgeCanonicalAsset = (asset: string): boolean =>
    getAssetBridge(asset)?.canonicalAsset === asset;

export const isBridgeVariant = (asset: string): boolean => {
    const bridge = getAssetBridge(asset);
    return bridge !== undefined && bridge.canonicalAsset !== asset;
};

export const getBridgeVariants = (canonical: string): string[] => {
    const { assets } = getBoltzSwapsConfig();
    return Object.keys(assets).filter(
        (asset) =>
            asset !== canonical &&
            assets[asset]?.bridge?.canonicalAsset === canonical,
    );
};

export const isStablecoinAsset = (asset: string): boolean => {
    const direct = getAssetBridge(asset);
    if (direct !== undefined) {
        return (
            direct.kind === BridgeKind.Cctp || direct.kind === BridgeKind.Oft
        );
    }
    const canonical = getAssetBridge(getCanonicalAsset(asset));
    return (
        canonical !== undefined &&
        (canonical.kind === BridgeKind.Cctp ||
            canonical.kind === BridgeKind.Oft)
    );
};

// Display-friendly symbol overrides keyed on canonical asset (e.g. "L-BTC"
// renders as "LBTC", "USDT0" renders as "USDT")
const assetDisplaySymbols: Record<string, string> = {
    "L-BTC": "LBTC",
    USDT0: "USDT",
};

export const getAssetDisplaySymbol = (asset: string): string => {
    const canonicalAsset = getCanonicalAsset(asset);
    return assetDisplaySymbols[canonicalAsset] ?? canonicalAsset;
};

export const getNetworkTransport = (
    asset?: string,
): NetworkTransport | undefined =>
    asset === undefined ? undefined : getAssetConfig(asset)?.network?.transport;

export const isEvmAsset = (asset: string): boolean => {
    const assetConfig = getAssetConfig(asset);
    if (!assetConfig) {
        return false;
    }

    if (assetConfig.type === AssetKind.EVMNative) {
        return true;
    }

    return (
        assetConfig.type === AssetKind.ERC20 &&
        assetConfig.network?.transport === NetworkTransport.Evm
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

export const getEvmAssets = (): string[] =>
    Object.keys(getBoltzSwapsConfig().assets).filter(isEvmAsset);

export const hasEvmAssets = (): boolean => getEvmAssets().length > 0;

export const getCanonicalAsset = (asset: string): string =>
    getAssetBridge(asset)?.canonicalAsset ?? asset;

const getCanonicalAssetConfig = (asset: string) =>
    getAssetConfig(getCanonicalAsset(asset));

export const getRouteViaAsset = (asset: string): string | undefined =>
    getAssetConfig(asset)?.token?.routeVia ??
    getCanonicalAssetConfig(asset)?.token?.routeVia;

export const getBridgeMesh = (from: string, to?: string): Usdt0Kind => {
    const meshKinds = [from, to]
        .filter((candidate): candidate is string => candidate !== undefined)
        .map((candidate) => {
            const bridge = getAssetConfig(candidate)?.bridge;
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

export const getKindForAsset = (asset: string): AssetKind => {
    const assetConfig = getAssetConfig(asset);
    if (!assetConfig) {
        return AssetKind.UTXO;
    }

    return assetConfig.type;
};

export const hasTokenConfig = (
    asset: string,
): { address: string; decimals: number } | undefined => {
    const assetConfig = getAssetConfig(asset);
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

export const getTokenAddress = (asset: string): string =>
    requireTokenConfig(asset).address;

export const getTokenDecimals = (asset: string): number =>
    requireTokenConfig(asset).decimals;

export const getRouterAddress = (asset: string): string | undefined => {
    const assetConfig = getAssetConfig(asset);
    if (!assetConfig) {
        return undefined;
    }

    const routeVia = getRouteViaAsset(asset);
    if (routeVia) {
        return getAssetConfig(routeVia)?.contracts?.router;
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

export const getRpcUrls = (asset: string): readonly string[] | undefined => {
    const rpcUrls = getAssetConfig(asset)?.network?.rpcUrls;
    return rpcUrls && rpcUrls.length > 0 ? rpcUrls : undefined;
};

export const requireRpcUrls = (asset: string): readonly string[] => {
    const rpcUrls = getRpcUrls(asset);
    if (rpcUrls === undefined || rpcUrls.length === 0) {
        throw new Error(`missing RPC configuration for asset: ${asset}`);
    }

    return rpcUrls;
};

export const requireChainId = (asset: string): number => {
    const chainId = getAssetConfig(asset)?.network?.chainId;
    if (chainId === undefined) {
        throw new Error(`missing chainId for asset: ${asset}`);
    }
    return chainId;
};

export const getContractDeployHeight = (asset: string): number | undefined =>
    getAssetConfig(asset)?.contracts?.deployHeight;

export const getBoltzApiUrl = (): string => getBoltzSwapsConfig().boltzApiUrl;

export const getReferralHeader = (): string | undefined =>
    getBoltzSwapsConfig().referral;

export const isCooperativeDisabled = (): boolean =>
    getBoltzSwapsConfig().cooperativeDisabled === true;
