import log from "loglevel";

const defaults = {
    // Disables API endpoints that create cooperative signatures for claim
    // and refund transactions
    // **Should only be enabled for testing purposes**
    cooperativeDisabled: false,

    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    supportUrl: "https://support.boltz.exchange/hc/center",
    discordUrl: "https://discord.gg/6bymCFzV52",
    githubUrl: "https://github.com/SwapMarket",
    repoUrl: "https://github.com/SwapMarket/swapmarket.github.io",
    docsUrl:
        "https://github.com/SwapMarket/swapmarket.github.io/blob/main/README.md",
    tetherUrl: "/usdt",
    blogUrl: "https://stacker.news/SwapMarket/posts",
    nostrUrl: "https://iris.to/swapmarket",
    statusUrl: "https://status.boltz.exchange",
    testnetUrl: "/testnet",
    telegramUrl: "https://t.me/+w0F2zxxoLg85YzM6",
    email: "swapmarket.wizard996@passinbox.com",
    dnsOverHttps: "https://1.1.1.1/dns-query",
    chatwootUrl: "https://support.boltz.exchange",
    preimageValidation: "https://validate-payment.com",
};

type Asset = {
    blockExplorerUrl?: Url;

    rifRelay?: string;
    contracts?: {
        deployHeight: number;
        smartWalletFactory?: string;
        deployVerifier?: string;
    };
    network?: {
        chainName: string;
        rpcUrls: string[];
        nativeCurrency: {
            name: string;
            symbol: string;
            decimals: number;
        };
    };
};

type Url = {
    normal: string;
    tor?: string;
};

type Backend = {
    alias: string;
    // The wsFallback is used on regtest when the backend is being run without
    // nginx and the WebSocket is on a different port than the rest of the API
    apiUrl: Url & { wsFallback?: string };
    contact: string;
};

export type Config = {
    network?: "mainnet" | "testnet" | "regtest";
    backends?: Backend[];
    isBoltzClient?: boolean;
    boltzClientApiUrl?: string;
    isBeta?: boolean;
    assets?: Record<string, Asset>;
    torUrl?: string;
} & typeof defaults;

let config: Config = defaults;

const isTor = () => window?.location.hostname.endsWith(".onion");

export const chooseUrl = (url?: Url) =>
    url ? (isTor() && url.tor ? url.tor : url.normal) : undefined;

export const setConfig = (data: Config) => {
    config = { ...defaults, ...data };
    log.setLevel(config.loglevel);
};

export { config };
