const apiUrl = "https://testnet.boltz.exchange/api";
const blockExplorerUrl = "https://mempool.space/testnet";
const blockExplorerUrlLiquid = "https://liquid.network/testnet";

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
    "R-BTC/BTC": {
        apiUrl: apiUrl,
        blockExplorerUrl: blockExplorerUrlLiquid,
    },
};
