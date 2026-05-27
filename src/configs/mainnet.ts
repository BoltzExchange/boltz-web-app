import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import { AssetKind, Explorer } from "boltz-swaps/types";
import { type Config, baseConfig, chooseUrl } from "src/configs/base";
import { envRpcUrls } from "src/configs/rpcs";
import { usdt0CanSendOverrides } from "src/configs/usdt0";

const mainnetPreset = buildMainnetConfig({
    rpcUrls: envRpcUrls,
    canSend: usdt0CanSendOverrides,
});

const config = {
    ...baseConfig,
    torUrl: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/",
    sideswapUrl: "wss://api.sideswap.io/json-rpc-ws",
    network: "mainnet",
    loglevel: "debug",
    apiUrl: {
        normal: "https://api.boltz.exchange",
        tor: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api",
    },
    cctpApiUrl: mainnetPreset.cctpApiUrl,
    solburnUrl: mainnetPreset.solburnUrl,
    assets: {
        ...mainnetPreset.assets,
        "L-USDt": {
            type: AssetKind.LiquidToken,
            canSend: false,
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
            liquidToken: {
                assetId:
                    "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2",
                precision: 8,
                routeVia: "L-BTC",
            },
        },
    },
} as Config;

export { config, chooseUrl };
