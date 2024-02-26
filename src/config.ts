import { makePersisted } from "@solid-primitives/storage";
import log from "loglevel";
import { createSignal } from "solid-js";

export const [config, setConfig] = makePersisted(
    createSignal({
        defaultLanguage: "en",
        apiUrl: "",
        network: "main",
        boltzClientApiUrl: "",
        loglevel: "debug",
        isBeta: false,
        assets: [],
        torUrl: "",

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
    }),
    { name: "config" },
);

export const configReady = () => config().apiUrl != "";

export function updateConfig(data: any) {
    const isTor = window.location.hostname.endsWith(".onion");
    const parseUrl = (url: any) => (isTor && url.tor ? url.tor : url.normal);
    data.apiUrl = parseUrl(data.apiUrl);
    Object.values(data.assets).forEach((asset: any) => {
        asset.apiUrl = asset.apiUrl ? parseUrl(asset.apiUrl) : asset.apiUrl;
        asset.blockExplorerUrl = parseUrl(asset.blockExplorerUrl);
    });
    setConfig((prev) => ({ ...prev, ...data }));
    log.setLevel(config().loglevel as log.LogLevelDesc);
}
