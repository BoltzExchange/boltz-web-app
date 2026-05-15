import type { BoltzSwapsConfig } from "../../src/config.ts";
import {
    type Asset,
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    NetworkTransport,
    Usdt0Kind,
} from "../../src/types.ts";
import {
    evmMessageTransmitterV2,
    evmTokenMessengerV2,
    solanaMessageTransmitterV2,
    solanaTokenMessengerMinterV2,
} from "./cctp.ts";

const arbitrumNetwork = {
    symbol: "ARB",
    gasToken: "ETH",
    chainName: "Arbitrum One",
    transport: NetworkTransport.Evm,
    chainId: 42161,
    rpcUrls: ["https://arb1.arbitrum.io/rpc"] as readonly string[],
    nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
    },
};

export const mainnetAssets: Record<string, Asset> = {
    BTC: { type: AssetKind.UTXO },
    "L-BTC": { type: AssetKind.UTXO },
    RBTC: {
        type: AssetKind.EVMNative,
        network: {
            chainName: "Rootstock",
            symbol: "RBTC",
            gasToken: "RBTC",
            transport: NetworkTransport.Evm,
            chainId: 30,
            rpcUrls: ["https://public-node.rsk.co"],
            nativeCurrency: {
                name: "RBTC",
                symbol: "RBTC",
                decimals: 18,
            },
        },
        rifRelay: "https://boltz.mainnet.relay.rifcomputing.net",
        contracts: {
            deployHeight: 6747215,
            smartWalletFactory: "0x44944a80861120B58cc48B066d57cDAf5eC213dd",
            deployVerifier: "0xc0F5bEF6b20Be41174F826684c663a8635c6A081",
        },
    },
    TBTC: {
        type: AssetKind.ERC20,
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
        network: arbitrumNetwork,
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: { mesh: Usdt0Kind.Native },
        },
        token: {
            address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            decimals: 6,
            routeVia: "TBTC",
        },
    },
    USDC: {
        type: AssetKind.ERC20,
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

    "USDT0-ETH": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Ethereum",
            symbol: "ETH",
            gasToken: "ETH",
            transport: NetworkTransport.Evm,
            chainId: 1,
            rpcUrls: ["https://ethereum-rpc.publicnode.com"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        },
        token: {
            address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: { mesh: Usdt0Kind.Native },
        },
    },
    "USDT0-POL": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Polygon PoS",
            symbol: "POL",
            gasToken: "POL",
            transport: NetworkTransport.Evm,
            chainId: 137,
            rpcUrls: ["https://polygon-bor-rpc.publicnode.com"],
            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
        },
        token: {
            address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: { mesh: Usdt0Kind.Native },
        },
    },
    "USDT0-BERA": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Berachain",
            symbol: "BERA",
            gasToken: "BERA",
            transport: NetworkTransport.Evm,
            chainId: 80094,
            rpcUrls: ["https://rpc.berachain.com"],
            nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
        },
        token: {
            address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: { mesh: Usdt0Kind.Native },
        },
    },
    "USDT0-SOL": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Solana",
            symbol: "SOL",
            gasToken: "SOL",
            transport: NetworkTransport.Solana,
            rpcUrls: [
                "https://api.mainnet.solana.com",
                "https://solana-rpc.publicnode.com",
            ],
            nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
        },
        token: {
            address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: {
                mesh: Usdt0Kind.Legacy,
                quotePayer: "EzTybRqGouGB4vKin67HFYgLsVkzE6A1YUq26uKyTvPN",
            },
        },
    },
    "USDT0-TRON": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Tron",
            symbol: "TRX",
            gasToken: "TRX",
            transport: NetworkTransport.Tron,
            rpcUrls: [
                "https://tron-rpc.publicnode.com",
                "https://api.trongrid.io",
            ],
            nativeCurrency: { name: "TRX", symbol: "TRX", decimals: 6 },
        },
        token: {
            address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Oft,
            canonicalAsset: "USDT0",
            oft: { mesh: Usdt0Kind.Legacy },
        },
    },

    "USDC-BASE": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Base",
            symbol: "BASE",
            gasToken: "ETH",
            transport: NetworkTransport.Evm,
            chainId: 8453,
            rpcUrls: ["https://mainnet.base.org"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        },
        token: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Cctp,
            canonicalAsset: "USDC",
            cctp: {
                domain: 6,
                tokenMessenger: evmTokenMessengerV2,
                messageTransmitter: evmMessageTransmitterV2,
                transferMode: CctpTransferMode.Fast,
            },
        },
    },
    "USDC-ETH": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Ethereum",
            symbol: "ETH",
            gasToken: "ETH",
            transport: NetworkTransport.Evm,
            chainId: 1,
            rpcUrls: ["https://ethereum-rpc.publicnode.com"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        },
        token: {
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Cctp,
            canonicalAsset: "USDC",
            cctp: {
                domain: 0,
                tokenMessenger: evmTokenMessengerV2,
                messageTransmitter: evmMessageTransmitterV2,
                transferMode: CctpTransferMode.Fast,
            },
        },
    },
    "USDC-POL": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Polygon PoS",
            symbol: "POL",
            gasToken: "POL",
            transport: NetworkTransport.Evm,
            chainId: 137,
            rpcUrls: ["https://polygon-bor-rpc.publicnode.com"],
            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
        },
        token: {
            address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Cctp,
            canonicalAsset: "USDC",
            cctp: {
                domain: 7,
                tokenMessenger: evmTokenMessengerV2,
                messageTransmitter: evmMessageTransmitterV2,
                transferMode: CctpTransferMode.Fast,
            },
        },
    },
    "USDC-SOL": {
        type: AssetKind.ERC20,
        canSend: true,
        network: {
            chainName: "Solana",
            symbol: "SOL",
            gasToken: "SOL",
            transport: NetworkTransport.Solana,
            rpcUrls: [
                "https://api.mainnet.solana.com",
                "https://solana-rpc.publicnode.com",
            ],
            nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
        },
        token: {
            address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            decimals: 6,
        },
        bridge: {
            kind: BridgeKind.Cctp,
            canonicalAsset: "USDC",
            cctp: {
                domain: 5,
                tokenMessenger: solanaTokenMessengerMinterV2,
                messageTransmitter: solanaMessageTransmitterV2,
                transferMode: CctpTransferMode.Fast,
            },
        },
    },
};

export const cctpApiUrl = "https://iris-api.circle.com";
export const cctpExplorerUrl = "https://www.circle.com/explorer";
export const layerZeroExplorerUrl = "https://layerzeroscan.com";
export const oftDeploymentsUrl = "https://docs.usdt0.to/api/deployments";

export const mainnetBoltzSwapsConfig: BoltzSwapsConfig = {
    assets: mainnetAssets,
    cctpApiUrl,
    cctpExplorerUrl,
    layerZeroExplorerUrl,
    oftDeploymentsUrl,
};
