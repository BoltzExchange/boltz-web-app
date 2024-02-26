import { makePersisted } from "@solid-primitives/storage";
import log from "loglevel";
import { createSignal } from "solid-js";

const defaults = {
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
    network?: string;
    isBoltzClient?: boolean;
    boltzClientApiUrl?: string;
    loglevel?: log.LogLevelDesc;
    isBeta?: boolean;
    assets?: Record<string, Asset>;
    torUrl?: string;
} & typeof defaults;

export const [config, setConfig] = makePersisted(
    createSignal<Config>(defaults),
    { name: "config" },
);

const isTor = window?.location.hostname.endsWith(".onion");

export const getUrl = (url?: Url) =>
    url ? (isTor && url.tor ? url.tor : url.normal) : undefined;

export const configReady = () => config().network != undefined;

export function updateConfig(data: any) {
    setConfig({ ...defaults, ...data });
    log.setLevel(config().loglevel as log.LogLevelDesc);
}
