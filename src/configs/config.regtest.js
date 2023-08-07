const apiUrl = "http://localhost:9001";
const blockExplorerUrl = "http://localhost:8090";
const blockExplorerUrlLiquid = "http://localhost:8091";

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
