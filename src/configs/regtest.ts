import {
    AssetType,
    type Config,
    ExplorerType,
    baseConfig,
    chooseUrl,
} from "src/configs/base";

const config = {
    ...baseConfig,
    network: "regtest",
    loglevel: "debug",
    apiUrl: {
        normal: "http://localhost:9006",
    },
    assets: {
        BTC: {
            type: AssetType.Native,
            blockExplorerUrl: {
                id: ExplorerType.Esplora,
                normal: "http://localhost:4002",
            },
            blockExplorerApis: [
                {
                    id: ExplorerType.Esplora,
                    normal: "http://localhost:4002/api",
                },
            ],
        },
        "L-BTC": {
            type: AssetType.Native,
            blockExplorerUrl: {
                id: ExplorerType.Esplora,
                normal: "http://localhost:4003",
            },
            blockExplorerApis: [
                {
                    id: ExplorerType.Esplora,
                    normal: "http://localhost:4003/api",
                },
            ],
        },
        RBTC: {
            type: AssetType.Native,
            blockExplorerUrl: {
                id: ExplorerType.Blockscout,
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
                router: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
                smartWalletFactory:
                    "0x59b670e9fA9D0A427751Af201D676719a970857b",
                deployVerifier: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
            },
        },
        "USDT0-RBTC": {
            type: AssetType.ERC20,
            erc20: {
                chain: "RBTC",
                decimals: 6,
                address: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
            },
        },
    },
} as Config;

export { config, chooseUrl };
