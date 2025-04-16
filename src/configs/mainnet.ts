import type { Config } from "src/configs/base";
import { baseConfig, chooseUrl } from "src/configs/base";

const config = {
    ...baseConfig,
    torUrl: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/",
    network: "mainnet",
    loglevel: "debug",
    backends: [
        {
            alias: "Boltz Exchange",
            apiUrl: {
                normal: "https://api.boltz.exchange",
                tor: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api",
            },
            contact: "https://boltz.exchange",
        },
        {
            alias: "Middle Way",
            apiUrl: {
                normal: "https://api.middleway.space",
                tor: "http://middlew7gmdp53psshnb3cn74zhhulor56lsk3alr2nsrgj7ukmz47id.onion",
            },
            contact: "https://t.me/MiddleWayNode",
        },
        {
            alias: "Eldamar",
            apiUrl: {
                normal: "https://boltz-api.eldamar.icu",
                tor: "http://mnyazp2duhs3jewqzw7g6vv44g73ijiujdmk5z6js72fn3epybup2yqd.onion",
            },
            contact: "https://t.me/SynthLock",
        },
    ],
    assets: {
        BTC: {
            blockExplorerUrl: {
                normal: "https://mempool.space",
                tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion",
            },
            blockExplorerApis: [
                {
                    normal: "https://blockstream.info/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/api",
                },
                {
                    normal: "https://mempool.space/api",
                    tor: "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/api",
                },
            ],
        },
        "L-BTC": {
            blockExplorerUrl: {
                normal: "https://blockstream.info/liquid",
                tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquid",
            },
            blockExplorerApis: [
                {
                    normal: "https://blockstream.info/liquid/api",
                    tor: "http://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion/liquid/api",
                },
                {
                    normal: "https://liquid.network/api",
                    tor: "http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/api",
                },
            ],
        },
        RBTC: {
            blockExplorerUrl: {
                normal: "https://rootstock.blockscout.com",
            },
            network: {
                chainName: "Rootstock",
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
                smartWalletFactory:
                    "0x44944a80861120B58cc48B066d57cDAf5eC213dd",
                deployVerifier: "0xc0F5bEF6b20Be41174F826684c663a8635c6A081",
            },
        },
    },
} as Config;

export { config, chooseUrl };
