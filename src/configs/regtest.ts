import type { Config } from "src/configs/base";
import { Explorer, baseConfig, chooseUrl } from "src/configs/base";
import { AssetKind } from "src/consts/AssetKind";

const arbitrumExplorer = {
    id: Explorer.Blockscout,
    normal: "https://arbiscan.io",
};

const arbitrumNetwork = {
    symbol: "ARB",
    chainName: "Arbitrum",
    chainId: 42161,
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
    },
};

const config = {
    ...baseConfig,
    network: "regtest",
    loglevel: "debug",
    preventReloadOnPendingSwaps: false,
    apiUrl: {
        normal: "http://localhost:9006",
    },
    assets: {
        BTC: {
            type: AssetKind.UTXO,
            blockExplorerUrl: {
                id: Explorer.Esplora,
                normal: "http://localhost:4002",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "http://localhost:4002/api",
                },
            ],
        },
        "L-BTC": {
            type: AssetKind.UTXO,
            blockExplorerUrl: {
                id: Explorer.Esplora,
                normal: "http://localhost:4003",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "http://localhost:4003/api",
                },
            ],
        },
        RBTC: {
            type: AssetKind.EVMNative,
            blockExplorerUrl: {
                id: Explorer.Blockscout,
                normal: "http://localhost:5100",
            },
            network: {
                chainName: "Anvil",
                symbol: "RBTC",
                chainId: 31,
                rpcUrls: ["http://localhost:8545"],
                nativeCurrency: {
                    name: "RBTC",
                    symbol: "RBTC",
                    decimals: 18,
                },
            },
            rifRelay: "http://localhost:8090",
            contracts: {
                deployHeight: 0,
                smartWalletFactory:
                    "0x59b670e9fA9D0A427751Af201D676719a970857b",
                deployVerifier: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
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
                deployHeight: 421213458,
                router: "0x26e61312fA23a940Bed5A576a819cC5fa095B09C",
            },
        },
        USDT0: {
            type: AssetKind.ERC20,
            blockExplorerUrl: arbitrumExplorer,
            network: arbitrumNetwork,
            token: {
                address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                decimals: 6,
                routeVia: "TBTC",
            },
        },
    },
} as Config;

export { config, chooseUrl };
