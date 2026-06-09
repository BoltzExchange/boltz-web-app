import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import { AssetKind, Explorer, NetworkTransport } from "boltz-swaps/types";
import { type Config, baseConfig, chooseUrl } from "src/configs/base";

const mainnetPreset = buildMainnetConfig({
    filterAssets: (asset) => asset === "TBTC" || asset === "USDT0",
    rpcUrls: {
        ARB: ["http://127.0.0.1:18545"],
    },
});

const stablecoins = {
    TBTC: {
        ...mainnetPreset.assets.TBTC,
        contracts: {
            ...mainnetPreset.assets.TBTC.contracts,
            deployHeight: 465600400,
        },
    },
    USDT0: mainnetPreset.assets.USDT0,
};

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
                id: Explorer.EtherscanStyle,
                normal: "http://localhost:5100",
            },
            network: {
                chainName: "Anvil",
                symbol: "RBTC",
                gasToken: "RBTC",
                chainId: 33,
                transport: NetworkTransport.Evm,
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
        ...stablecoins,
    },
    gasSponsor: {
        normal: "http://localhost:18547/alchemy",
        tor: "http://localhost:18547/alchemy",
    },
} as Config;

export { config, chooseUrl };
