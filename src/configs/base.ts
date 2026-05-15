import type { Asset, Url } from "boltz-swaps/types";
import type log from "loglevel";

export { arbitrumChainId } from "boltz-swaps/types";

export type Config = {
    apiUrl: Url;
    network: "mainnet" | "testnet" | "regtest";
    isBeta?: boolean;
    isPro?: boolean;
    assets?: Record<string, Asset>;
    cctpApiUrl?: string;
    solburnUrl?: string;
    torUrl?: string;
} & typeof defaults;

const defaults = {
    // Disables API endpoints that create cooperative signatures for claim
    // and refund transactions
    // **Should only be enabled for testing purposes**
    cooperativeDisabled: false,

    preventReloadOnPendingSwaps: true,

    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    corsProxyUrl: "https://cors-proxy.m1011at.workers.dev/",
    supportUrl: "https://support.boltz.exchange/hc/center",
    twitterUrl: "https://twitter.com/boltzhq",
    githubUrl: "https://github.com/BoltzExchange",
    repoUrl: "https://github.com/BoltzExchange/boltz-web-app",
    docsUrl: "https://docs.boltz.exchange",
    blogUrl: "https://blog.boltz.exchange",
    partnerUrl: "https://partner.boltz.exchange",
    nostrUrl:
        "https://primal.net/p/nprofile1qqsqcdcltmv4qanpx3p7svcufdsg9rkk00x7l2sknra4e6whkv59l7clgcdzj",
    statusUrl: "https://status.boltz.exchange",
    youtubeUrl:
        "https://www.youtube.com/playlist?list=PLkqOa9SGBeZfAEHvKkGKjeRIASeu6bNO3",
    brandingUrl: "https://github.com/BoltzExchange/logo",
    regtestUrl: "https://github.com/BoltzExchange/regtest/",
    email: "hi@bol.tz",
    dnsOverHttps: "https://1.1.1.1/dns-query",
    chatwootUrl: "https://support.boltz.exchange",
    preimageValidation: "https://validate-payment.com",
    layerZeroExplorerUrl: "https://layerzeroscan.com",
    cctpExplorerUrl: "https://ccxp.space",
    oftDeploymentsUrl: "https://docs.usdt0.to/api/deployments",
    rateProviders: {
        Yadio: "https://api.yadio.io/exrates/btc",
        Kraken: "https://api.kraken.com/0/public/Ticker",
        Mempool: "https://mempool.space/api/v1/prices",
        CoinGecko: "https://api.coingecko.com/api/v3/simple/price",
    },
};

const isTor = () =>
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".onion");

const chooseUrl = (url?: Url) =>
    url ? (isTor() && url.tor ? url.tor : url.normal) : undefined;

const baseConfig: Omit<Config, "network" | "apiUrl"> = defaults;

export { baseConfig, chooseUrl, isTor };
