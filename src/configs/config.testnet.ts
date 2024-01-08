// @ts-ignore
export * from "./configs/templates/defaults";

const apiUrl = "https://testnet.boltz.exchange/api";
const blockExplorerUrl = "https://blockstream.info/testnet";
const blockExplorerUrlLiquid = "https://blockstream.info/liquidtestnet";
const blockExplorerUrlRsk = "https://explorer.testnet.rsk.co";

export const network: string = "testnet";
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
    "RBTC/BTC": {
        apiUrl: apiUrl,
        blockExplorerUrl: blockExplorerUrlRsk,
    },
};
