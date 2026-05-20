import axios from "axios";
import { setBoltzSwapsConfig } from "boltz-swaps/config";
import { setLogger } from "boltz-swaps/logger";
import log from "loglevel";

import { config as runtimeConfig } from "../src/config";
import { chooseUrl } from "../src/configs/base";
import { config as mainnetConfig } from "../src/configs/mainnet";

log.setLevel("error");
setLogger(log);

setBoltzSwapsConfig({
    get assets() {
        return runtimeConfig.assets;
    },
    get cctpApiUrl() {
        return runtimeConfig.cctpApiUrl;
    },
    get layerZeroExplorerUrl() {
        return runtimeConfig.layerZeroExplorerUrl;
    },
    get cctpExplorerUrl() {
        return runtimeConfig.cctpExplorerUrl;
    },
    get oftDeploymentsUrl() {
        return runtimeConfig.oftDeploymentsUrl;
    },
    get boltzApiUrl() {
        return chooseUrl(runtimeConfig.apiUrl);
    },
    get referral() {
        return "boltz_webapp_desktop";
    },
    get cooperativeDisabled() {
        return runtimeConfig.cooperativeDisabled === true;
    },
});

// Tests run against the regtest config, which intentionally omits TBTC,
// WBTC, USDT0, and USDC (they're mainnet-only assets). Inject them from the mainnet
// config so tests that read their shape (token decimals, bridge metadata, etc.) work.
if (runtimeConfig.assets && mainnetConfig.assets) {
    runtimeConfig.assets.TBTC ??= mainnetConfig.assets.TBTC;
    runtimeConfig.assets.WBTC ??= mainnetConfig.assets.WBTC;
    runtimeConfig.assets.USDT0 ??= mainnetConfig.assets.USDT0;
    runtimeConfig.assets.USDC ??= mainnetConfig.assets.USDC;
}

// Replace jsdom's fetch with axios-based fetch to fix AbortController compatibility
const axiosFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> => {
    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

    try {
        const response = await axios({
            url,
            method: init?.method || "GET",
            headers: init?.headers as Record<string, string>,
            data: init?.body,
            signal: init?.signal as AbortSignal,
        });

        return new Response(JSON.stringify(response.data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as HeadersInit,
        });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return new Response(JSON.stringify(error.response.data), {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers as HeadersInit,
            });
        }
        throw error;
    }
};

globalThis.fetch = axiosFetch as typeof fetch;
