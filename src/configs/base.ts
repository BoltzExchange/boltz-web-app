import type log from "loglevel";

type Asset = {
    blockExplorerUrl?: Url;
    blockExplorerApis?: Url[];

    rifRelay?: string;
    contracts?: {
        deployHeight: number;
        smartWalletFactory?: string;
        deployVerifier?: string;
    };
    network?: {
        chainName: string;
        chainId: number;
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

export type Config = {
    apiUrl?: Url;
    network?: "mainnet" | "testnet" | "regtest";
    isBoltzClient?: boolean;
    boltzClientApiUrl?: string;
    isBeta?: boolean;
    isPro?: boolean;
    assets?: Record<string, Asset>;
    torUrl?: string;
} & typeof defaults;

const defaults = {
    // Disables API endpoints that create cooperative signatures for claim
    // and refund transactions
    // **Should only be enabled for testing purposes**
    cooperativeDisabled: false,

    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    supportUrl: "https://support.boltz.exchange/hc/center",
    discordUrl: "https://discord.gg/QBvZGcW",
    twitterUrl: "https://twitter.com/boltzhq",
    githubUrl: "https://github.com/BoltzExchange",
    repoUrl: "https://github.com/BoltzExchange/boltz-web-app",
    docsUrl: "https://docs.boltz.exchange",
    blogUrl: "https://blog.boltz.exchange",
    nostrUrl:
        "https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970",
    statusUrl: "https://status.boltz.exchange",
    youtubeUrl:
        "https://www.youtube.com/playlist?list=PLkqOa9SGBeZfAEHvKkGKjeRIASeu6bNO3",
    brandingUrl: "https://github.com/BoltzExchange/logo",
    testnetUrl: "https://testnet.boltz.exchange",
    telegramUrl: "https://t.me/boltzhq",
    email: "hi@bol.tz",
    dnsOverHttps: "https://1.1.1.1/dns-query",
    chatwootUrl: "https://support.boltz.exchange",
    preimageValidation: "https://validate-payment.com",
};

const isTor = () => window?.location.hostname.endsWith(".onion");

const chooseUrl = (url?: Url) =>
    url ? (isTor() && url.tor ? url.tor : url.normal) : undefined;

const baseConfig: Config = defaults;

export { baseConfig, chooseUrl };
