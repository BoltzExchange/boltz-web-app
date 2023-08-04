export const defaultLanguage = "en";
export const network = "regtest";
export const isBeta = false;
export const bolt11_prefix = "lnbcrt";
export const loglevel = "debug";
export const apiUrl = "http://localhost:9001";
export const blockexplorerUrl = "http://localhost:8090";
export const blockexplorerUrlLiquid = "http://localhost:8091";
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
