import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
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
    network: "mainnet",
    loglevel: "debug",
    apiUrl: {
        normal: "https://api.boltz.exchange",
        tor: "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api",
    },
    cctpApiUrl: mainnetPreset.cctpApiUrl,
    assets: mainnetPreset.assets,
} as Config;

export { config, chooseUrl };
