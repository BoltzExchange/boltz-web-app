const apiUrl = "http://localhost:9001";
const blockExplorerUrl = "http://localhost:8090";
const blockExplorerUrlLiquid = "http://localhost:8091";

export const torUrl = "";
export const discordUrl = "https://discord.gg/QBvZGcW";
export const twitterUrl = "https://twitter.com/boltzhq";
export const githubUrl = "https://github.com/BoltzExchange";
export const docsUrl = "https://docs.boltz.exchange";
export const blogUrl = "https://blog.boltz.exchange";
export const nostrUrl =
    "https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970";

export const defaultLanguage = "en";
export const network = "regtest";
export const isBeta = false;
export const bolt11_prefix = "lnbcrt";
export const loglevel = "debug";

export const pairs = {
    "BTC/BTC": {
        apiUrl: apiUrl,
        blockExplorerUrl: blockExplorerUrl,
    },
    "L-BTC/BTC": {
        apiUrl: apiUrl,
        blockExplorerUrl: blockExplorerUrlLiquid,
    },
};
