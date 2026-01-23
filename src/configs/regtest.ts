import type { Config } from "src/configs/base";
import { Explorer, baseConfig, chooseUrl } from "src/configs/base";

const config = {
    ...baseConfig,
    network: "regtest",
    loglevel: "debug",
    preventReloadOnPendingSwaps: false,
    apiUrl: {
        normal: "http://localhost:9001",
    },
    assets: {
        BTC: {
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
            blockExplorerUrl: {
                id: Explorer.Blockscout,
                normal: "http://localhost:5100",
            },
            network: {
                chainName: "Anvil",
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
    },
} as Config;

export { config, chooseUrl };
