import log from "loglevel";
import { chooseUrl, config } from "../config";

export type UTXO = {
    txid: string;
    vout: number;
    status: {
        confirmed: boolean;
    };
}

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
): Promise<{ hex: string }> => {
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
