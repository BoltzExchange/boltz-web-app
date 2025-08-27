import { type Config, Explorer } from "src/configs/base";
import { baseConfig, chooseUrl } from "src/configs/base";

const config = {
    ...baseConfig,
    network: "testnet",
    loglevel: "debug",
    apiUrl: {
        normal: "https://api.testnet.boltz.exchange",
    },
    assets: {
        BTC: {
            blockExplorerUrl: {
                id: Explorer.Esplora,
                normal: "https://blockstream.info/testnet",
                tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/testnet",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "https://blockstream.info/testnet/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/api",
                },
                {
                    id: Explorer.Mempool,
                    normal: "https://mempool.space/testnet/api/v1",
                    tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/testnet/api/v1",
                },
            ],
        },
        "L-BTC": {
            blockExplorerUrl: {
                id: Explorer.Esplora,
                normal: "https://blockstream.info/liquidtestnet",
                tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquidtestnet",
            },
            blockExplorerApis: [
                {
                    id: Explorer.Esplora,
                    normal: "https://blockstream.info/liquidtestnet/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquidtestnet/api",
                },
                {
                    id: Explorer.Mempool,
                    normal: "https://liquid.network/liquidtestnet/api/v1",
                    tor: "http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/liquidtestnet/api/v1",
                },
            ],
        },
        RBTC: {
            blockExplorerUrl: {
                id: Explorer.Blockscout,
                normal: "https://rootstock-testnet.blockscout.com",
            },
            network: {
                chainName: "Rootstock Testnet",
                chainId: 31,
                rpcUrls: ["https://public-node.testnet.rsk.co"],
                nativeCurrency: {
                    name: "RBTC",
                    symbol: "RBTC",
                    decimals: 18,
                },
            },
            rifRelay: "https://boltz.testnet.relay.rifcomputing.net",
            contracts: {
                deployHeight: 4781682,
                smartWalletFactory:
                    "0x82bc3558863b3f0C9914539DbB2d143AfB9c8768",
                deployVerifier: "0x5e8F98ddAd4Da6eE8A8eA3D64E09385dF6b609D0",
            },
        },
    },
} as Config;

export { config, chooseUrl };
