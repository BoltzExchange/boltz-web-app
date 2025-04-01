import log from "loglevel";

import { chooseUrl, config } from "../config";
import { SwapType } from "../consts/Enums";
import { LockupTransaction } from "./boltzClient";
import { ChainSwap, SubmarineSwap } from "./swapCreator";

export type UTXO = {
    txid: string;
    vout: number;
};

export const fetchUTXOsWithFailover = async (
    asset: string,
    address: string,
): Promise<UTXO[]> => {
    for (const url of config.assets[asset].blockExplorerApis) {
        try {
            const basePath = chooseUrl(url);
            const response = await fetch(`${basePath}/address/${address}/utxo`);

            if (!response.ok) {
                log.error(`Failed to fetch UTXOs for ${address}`);
                continue;
            }

            return (await response.json()) as UTXO[];
        } catch (e) {
            log.error(`Failed to fetch UTXOs for ${address}: ${e.stack}`);
            continue;
        }
    }

    throw new Error("all block explorer APIs failed");
};

export const fetchRawTxWithFailover = async (
    asset: string,
    txid: string,
): Promise<Pick<LockupTransaction, "hex">> => {
    for (const url of config.assets[asset].blockExplorerApis) {
        try {
            const basePath = chooseUrl(url);
            const response = await fetch(`${basePath}/tx/${txid}/hex`);

            if (!response.ok) {
                log.error(`Failed to fetch raw tx for ${txid}`);
                continue;
            }

            return { hex: await response.text() };
        } catch (e) {
            log.error(`Failed to fetch raw tx for ${txid}: ${e.stack}`);
            continue;
        }
    }

    throw new Error("all block explorer APIs failed");
};

export const getSwapUTXOs = async (swap: ChainSwap | SubmarineSwap) => {
    const address =
        swap.type === SwapType.Chain
            ? (swap as ChainSwap).lockupDetails.lockupAddress
            : (swap as SubmarineSwap).address;

    const utxos = await fetchUTXOsWithFailover(swap.assetSend, address);

    const rawTxs: Pick<LockupTransaction, "hex">[] = [];

    for (const utxo of utxos) {
        const rawTx = await fetchRawTxWithFailover(swap.assetSend, utxo.txid);
        rawTxs.push({
            hex: rawTx.hex,
        });
    }

    return rawTxs;
};
