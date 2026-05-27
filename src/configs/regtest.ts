import { AssetKind, Explorer, NetworkTransport } from "boltz-swaps/types";
import { type Config, baseConfig, chooseUrl } from "src/configs/base";

const config = {
    ...baseConfig,
    network: "regtest",
    loglevel: "debug",
    preventReloadOnPendingSwaps: false,
    sideswapUrl: "ws://localhost:9006/json-rpc-ws",
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
        "L-USDt": {
            type: AssetKind.LiquidToken,
            canSend: false,
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
            liquidToken: {
                assetId:
                    "0f3cf1eddf84a24f2bb984a36e8de6a9e32fb35ae158ea4cf89fcb96b1d54d8a",
                precision: 8,
                routeVia: "L-BTC",
            },
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
    },
} as Config;

export { config, chooseUrl };
