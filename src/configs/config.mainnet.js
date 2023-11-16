const isTor = window?.location?.hostname.endsWith(".onion");

const apiUrl = isTor
    ? "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api"
    : "https://api.boltz.exchange";
const blockExplorerUrl = isTor
    ? "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion"
    : "https://mempool.space";
const blockExplorerUrlLiquid = isTor
    ? "http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion"
    : "https://liquid.network";

export const torUrl =
    "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/";
export const discordUrl = "https://discord.gg/QBvZGcW";
export const twitterUrl = "https://twitter.com/boltzhq";
export const githubUrl = "https://github.com/BoltzExchange";
export const docsUrl = "https://docs.boltz.exchange";
export const blogUrl = "https://blog.boltz.exchange";
export const nostrUrl =
    "https://snort.social/p/npub1psm37hke2pmxzdzraqe3cjmqs28dv77da74pdx8mtn5a0vegtlas9q8970";

export const defaultLanguage = "en";
export const network = "main";
export const isBeta = false;
export const bolt11_prefix = "lnbc";
export const loglevel = "info";

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
