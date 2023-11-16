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
// const blockExplorerUrlRsk = "https://explorer.rsk.co";

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
    // "RBTC/BTC": {
    //     apiUrl: apiUrl,
    //     blockExplorerUrl: blockExplorerUrlRsk,
    // },
};
