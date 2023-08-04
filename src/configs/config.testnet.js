export const defaultLanguage = "en";
export const network = "testnet";
export const isBeta = false;
export const bolt11_prefix = "lntb";
export const loglevel = "debug";
export const apiUrl = "https://testnet.boltz.exchange/api";
export const blockexplorerUrl = "https://mempool.space/testnet";
export const blockexplorerUrlLiquid = "https://liquid.network/testnet";

export const pairs = {
    "BTC/BTC": {
        api_url: apiUrl,
        blockexplorer_url: blockexplorerUrl,
    },
    "L-BTC/BTC": {
        api_url: apiUrl,
        blockexplorer_url: blockexplorerUrlLiquid,
    },
};
