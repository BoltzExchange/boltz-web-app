import log from "loglevel";

const defaults = {
    loglevel: "info" as log.LogLevelDesc,
    defaultLanguage: "en",
    lightningExplorerUrl: "https://amboss.space/node",
    discordUrl: "https://discord.gg/QBvZGcW",
    twitterUrl: "https://twitter.com/boltzhq",
    githubUrl: "https://github.com/BoltzExchange",
    repoUrl: "https://github.com/BoltzExchange/boltz-web-app",
    docsUrl: "https://docs.boltz.exchange",
    blogUrl: "https://blog.boltz.exchange",
    nostrUrl:
        "https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970",
    statusUrl: "https://status.boltz.exchange",
    youtubeUrl: "https://www.youtube.com/@boltzhq",
    brandingUrl: "https://github.com/BoltzExchange/logo",
    testnetUrl: "https://testnet.boltz.exchange",
    telegramUrl: "https://t.me/boltzhq",
    email: "hi@bol.tz",
};

type Asset = {
    blockExplorerUrl?: Url;
    apiUrl?: Url;
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
    assets?: Record<string, Asset>;
    torUrl?: string;
} & typeof defaults;

let config: Config = defaults;

export { config };

const isTor = window?.location.hostname.endsWith(".onion");

export const chooseUrl = (url?: Url) =>
    url ? (isTor && url.tor ? url.tor : url.normal) : undefined;

export const setConfig = (data: any) => {
    config = { ...defaults, ...data };
    log.setLevel(config.loglevel!);
};
