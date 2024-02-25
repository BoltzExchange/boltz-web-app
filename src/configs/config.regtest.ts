// @ts-ignore
export * from "./configs/templates/defaults";

const apiUrl = "http://localhost:9001";
const blockExplorerUrl = "http://localhost:8090";
const blockExplorerUrlLiquid = "http://localhost:8091";
const blockExplorerUrlRsk = "http://localhost:8092";

export const boltzClientApiUrl = "http://localhost:9003";
//export const boltzClientApiUrl = "";
export const network: string = "regtest";
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
    "RBTC/BTC": {
        apiUrl: apiUrl,
        blockExplorerUrl: blockExplorerUrlRsk,
    },
};
