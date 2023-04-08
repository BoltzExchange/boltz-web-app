import { networks } from "bitcoinjs-lib";
export const network = "regtest";
export const net = networks[network];
export const bolt11_prefix = "lnbcrt";
export const loglevel = "debug";
export const api_url = "http://localhost:9001";
export const mempool_url = "http://localhost:8080";
export const mempool_ws_url = "ws://localhost:8080/api/v1/ws";
