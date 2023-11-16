const apiUrl = "https://testnet.boltz.exchange/api";
const blockExplorerUrl = "https://mempool.space/testnet";
const blockExplorerUrlLiquid = "https://liquid.network/testnet";

export const torUrl = "";
export const discordUrl = "https://discord.gg/QBvZGcW";
export const twitterUrl = "https://twitter.com/boltzhq";
export const githubUrl = "https://github.com/BoltzExchange";
export const docsUrl = "https://docs.boltz.exchange";
export const blogUrl = "https://blog.boltz.exchange";
export const nostrUrl =
    "https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970";

export const defaultLanguage = "en";
export const network = "testnet";
export const isBeta = false;
export const bolt11_prefix = "lntb";
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
