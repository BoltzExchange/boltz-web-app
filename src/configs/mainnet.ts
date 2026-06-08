import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import { type Config, baseConfig, chooseUrl } from "src/configs/base";
import { envRpcUrls } from "src/configs/rpcs";
import { usdt0CanSendOverrides } from "src/configs/usdt0";

const mainnetPreset = buildMainnetConfig({
    rpcUrls: envRpcUrls,
    canSend: usdt0CanSendOverrides,
    btcMempoolApiUrl: import.meta.env.VITE_MEMPOOL_API_URL || undefined,
    // The SDK exposes the Arkade chain-swap source (asset id "ARK"), but the web
    // app has no Arkade wallet support yet, so keep it out of the app's asset
    // list (selector and `sendAsset`/`receiveAsset` URL params).
    filterAssets: (asset) => asset !== "ARK",
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
    solburnUrl: mainnetPreset.solburnUrl,
    assets: mainnetPreset.assets,
} as Config;

export { config, chooseUrl };
