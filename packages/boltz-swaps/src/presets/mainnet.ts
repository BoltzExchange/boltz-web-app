import {
    evmMessageTransmitterV2,
    evmTokenMessengerV2,
} from "../cctp/protocol.ts";
import {
    type CctpVariantAsset,
    cctpVariants,
    createCctpVariantAsset,
} from "../cctp/variants.ts";
import { type ChainKey, chains } from "../chains.ts";
import { type BoltzSwapsConfig, MAINNET_API_DEFAULTS } from "../config.ts";
import { getExplorerId } from "../evm/explorer.ts";
import {
    type Usdt0VariantAsset,
    createUsdt0VariantAsset,
    usdt0Variants,
} from "../oft/variants.ts";
import {
    type Asset,
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    Explorer,
    NetworkTransport,
    Usdt0Kind,
} from "../types.ts";

export type CoreMainnetAsset =
    | "BTC"
    | "L-BTC"
    | "RBTC"
    | "TBTC"
    | "USDT0"
    | "USDC";

export type MainnetAsset =
    | CoreMainnetAsset
    | CctpVariantAsset
    | Usdt0VariantAsset;

export type MainnetConfigOverrides = {
    boltzApiUrl?: string;
    cctpApiUrl?: string;
    cctpExplorerUrl?: string;
    layerZeroExplorerUrl?: string;
    oftDeploymentsUrl?: string;
    referral?: string;
    cooperativeDisabled?: boolean;
    // Per-chain RPC URL overrides. If provided, replaces the catalog defaults
    // for that chain (consumers using `prependEnv` should pass the merged list).
    rpcUrls?: Partial<Record<ChainKey, readonly string[]>>;
    // Per-variant `canSend` overrides keyed on asset symbol (e.g. "USDT0-OP").
    canSend?: Partial<Record<string, boolean>>;
    // Optional filter — variants returning `false` are dropped.
    filterAssets?: (asset: MainnetAsset) => boolean;
    gasTopUpSupported?: (asset: string) => boolean;
    getGasTopUpNativeAmount?: (asset: string) => Promise<bigint>;
};

const arbitrumExplorer = {
    id: Explorer.EtherscanStyle,
    normal: chains.ARB.explorerUrl,
};

const buildArbitrumNetwork = (
    rpcUrls: readonly string[],
): NonNullable<Asset["network"]> => ({
    symbol: chains.ARB.symbol,
    gasToken: chains.ARB.gasToken,
    chainName: chains.ARB.chainName,
    transport: chains.ARB.transport,
    chainId: chains.ARB.chainId,
    rpcUrls,
    nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: chains.ARB.nativeDecimals,
    },
});

const buildCoreAssets = (
    overrides: MainnetConfigOverrides,
): Record<CoreMainnetAsset, Asset> => {
    const arbRpcUrls = overrides.rpcUrls?.ARB ?? chains.ARB.defaultRpcUrls;
    const rbtcRpcUrls = overrides.rpcUrls?.RBTC ?? chains.RBTC.defaultRpcUrls;
    const arbitrumNetwork = buildArbitrumNetwork(arbRpcUrls);

    return {
        BTC: {
            type: AssetKind.UTXO,
            blockExplorerUrl: {
                id: Explorer.Mempool,
                normal: "https://mempool.space",
                tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "https://blockstream.info/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/api",
                },
                {
                    id: Explorer.Mempool,
                    normal: "https://mempool.space/api",
                    tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/api",
                },
            ],
        },
        "L-BTC": {
            type: AssetKind.UTXO,
            blockExplorerUrl: {
                id: Explorer.Esplora,
                normal: "https://blockstream.info/liquid",
                tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquid",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "https://blockstream.info/liquid/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquid/api",
                },
                {
                    id: Explorer.Mempool,
                    normal: "https://liquid.network/api",
                    tor: "http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/api",
                },
            ],
        },
        RBTC: {
            type: AssetKind.EVMNative,
            blockExplorerUrl: {
                id: getExplorerId(NetworkTransport.Evm),
                normal: chains.RBTC.explorerUrl,
            },
            network: {
                chainName: chains.RBTC.chainName,
                symbol: chains.RBTC.symbol,
                gasToken: chains.RBTC.gasToken,
                transport: chains.RBTC.transport,
                chainId: chains.RBTC.chainId,
                rpcUrls: rbtcRpcUrls,
                nativeCurrency: {
                    name: chains.RBTC.gasToken,
                    symbol: chains.RBTC.gasToken,
                    decimals: chains.RBTC.nativeDecimals,
                },
            },
            rifRelay: "https://boltz.mainnet.relay.rifcomputing.net",
            contracts: {
                deployHeight: 6747215,
                smartWalletFactory:
                    "0x44944a80861120B58cc48B066d57cDAf5eC213dd",
                deployVerifier: "0xc0F5bEF6b20Be41174F826684c663a8635c6A081",
            },
        },
        TBTC: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            token: {
                address: "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40",
                decimals: 18,
            },
            contracts: {
                deployHeight: 435848678,
                router: "0x182589d2A10384e12EE8C1Fe350F4dfba36C7b73",
            },
        },
        USDT0: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            bridge: {
                kind: BridgeKind.Oft,
                canonicalAsset: "USDT0",
                oft: {
                    mesh: Usdt0Kind.Native,
                },
            },
            token: {
                address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                decimals: 6,
                routeVia: "TBTC",
            },
        },
        USDC: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            bridge: {
                kind: BridgeKind.Cctp,
                canonicalAsset: "USDC",
                cctp: {
                    domain: 3,
                    tokenMessenger: evmTokenMessengerV2,
                    messageTransmitter: evmMessageTransmitterV2,
                    transferMode: CctpTransferMode.Fast,
                },
            },
            token: {
                address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                decimals: 6,
                routeVia: "TBTC",
            },
        },
    };
};

export const buildMainnetConfig = (
    overrides: MainnetConfigOverrides = {},
): BoltzSwapsConfig<MainnetAsset> => {
    const filter = overrides.filterAssets ?? (() => true);
    const assets: Partial<Record<MainnetAsset, Asset>> = {};

    const core = buildCoreAssets(overrides);
    for (const [symbol, asset] of Object.entries(core) as [
        CoreMainnetAsset,
        Asset,
    ][]) {
        if (filter(symbol)) {
            assets[symbol] = asset;
        }
    }

    for (const variant of cctpVariants) {
        const symbol = variant.asset as CctpVariantAsset;
        if (!filter(symbol)) {
            continue;
        }
        assets[symbol] = createCctpVariantAsset(variant, {
            rpcUrls: overrides.rpcUrls?.[variant.chain],
            canSend: overrides.canSend?.[variant.asset],
        });
    }

    for (const variant of usdt0Variants) {
        const symbol = variant.asset as Usdt0VariantAsset;
        if (!filter(symbol)) {
            continue;
        }
        assets[symbol] = createUsdt0VariantAsset(variant, {
            rpcUrls: overrides.rpcUrls?.[variant.chain],
            canSend: overrides.canSend?.[variant.asset],
        });
    }

    return {
        assets: assets as Record<MainnetAsset, Asset>,
        boltzApiUrl: overrides.boltzApiUrl ?? MAINNET_API_DEFAULTS.boltzApiUrl,
        cctpApiUrl: overrides.cctpApiUrl ?? MAINNET_API_DEFAULTS.cctpApiUrl,
        cctpExplorerUrl:
            overrides.cctpExplorerUrl ?? MAINNET_API_DEFAULTS.cctpExplorerUrl,
        layerZeroExplorerUrl:
            overrides.layerZeroExplorerUrl ??
            MAINNET_API_DEFAULTS.layerZeroExplorerUrl,
        oftDeploymentsUrl:
            overrides.oftDeploymentsUrl ??
            MAINNET_API_DEFAULTS.oftDeploymentsUrl,
        referral: overrides.referral,
        cooperativeDisabled: overrides.cooperativeDisabled,
        gasTopUpSupported: overrides.gasTopUpSupported ?? (() => false),
        getGasTopUpNativeAmount:
            overrides.getGasTopUpNativeAmount ?? (() => Promise.resolve(0n)),
    };
};

export const mainnetConfig = buildMainnetConfig();
