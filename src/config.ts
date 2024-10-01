import log from "loglevel";

const defaults = {
    // Disables API endpoints that create cooperative signatures for claim
    // and refund transactions
    // **Should only be enabled for testing purposes**
    cooperativeDisabled: false,

    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    discordUrl: "https://discord.gg/6bymCFzV52",
    githubUrl: "https://github.com/SwapMarket",
    repoUrl: "https://github.com/SwapMarket/swapmarket.github.io",
    docsUrl:
        "https://github.com/SwapMarket/swapmarket.github.io/blob/main/README.md",
    blogUrl: "https://stacker.news/SwapMarket/posts",
    nostrUrl: "https://iris.to/swapmarket",
    statusUrl: "https://status.boltz.exchange",
    testnetUrl: "/testnet",
    telegramUrl: "https://t.me/+w0F2zxxoLg85YzM6",
    email: "swapmarket.wizard996@passinbox.com",
};

type Asset = {
    network?: any;
    blockExplorerUrl?: Url;

    rifRelay?: string;
    contracts?: {
        deployHeight: number;
        smartWalletFactory?: string;
        deployVerifier?: string;
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

const isTor = () => {
    if (window?.location.hostname.endsWith(".onion")) {
        return true;
    }
    // Detect if Tor is blocking certain APIs (like window.OffscreenCanvas)
    const hasOffscreenCanvas = typeof window.OffscreenCanvas !== "undefined";
    const isTor = !hasOffscreenCanvas; // OffscreenCanvas is disabled in Tor
    return isTor;
};

export const chooseUrl = (url?: Url) =>
    url ? (isTor() && url.tor ? url.tor : url.normal) : undefined;

export const setConfig = (data: any) => {
    config = { ...defaults, ...data };
    log.setLevel(config.loglevel!);
};

export { config };
