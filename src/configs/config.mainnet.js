import { networks } from "bitcoinjs-lib";
export const network = "main";
export const net = networks[network];
export const bolt11_prefix = "lnbc";
export const loglevel = "info";
export const api_url = "https://boltz.exchange/api";
export const mempool_url = "https://mempool.space";
export const mempool_ws_url = "wss://mempool.space/api/v1/ws";
