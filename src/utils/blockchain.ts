import log from "loglevel";

import { chooseUrl, config } from "../config";
import { SwapType } from "../consts/Enums";
import { formatError } from "./errors";
import type { ChainSwap, SubmarineSwap } from "./swapCreator";

export type UTXO = {
    txid: string;
    vout: number;
};

const fetchBlockExplorer = async <T>({
    asset,
    endpoint,
    opts = {},
}: {
    asset: string;
    endpoint: string;
    opts?: RequestInit;
}) => {
    for (const url of config.assets[asset].blockExplorerApis) {
        try {
            const basePath = chooseUrl(url);
            const response = await fetch(`${basePath}${endpoint}`, opts);

            if (!response.ok) {
                try {
                    const body = await response.json();
                    log.error(`failed to fetch ${endpoint}`, formatError(body));
                    continue;
                } catch {
                    // If parsing JSON fails, throw a generic error with status text
                    log.error(response.statusText);
                    continue;
                }
            }

            const contentType = response.headers.get("content-type");

            if (contentType?.includes("application/json")) {
                return (await response.json()) as T;
            }

            return (await response.text()) as T;
        } catch (e) {
            log.error(`failed to fetch ${endpoint}`, e);
            continue;
        }
    }

    throw new Error("all block explorer APIs failed");
};

const getAddressUTXOs = async (asset: string, address: string) => {
    return await fetchBlockExplorer<UTXO[]>({
        asset,
        endpoint: `/address/${address}/utxo`,
    });
};

const getRawTransaction = async (asset: string, txid: string) => {
    return await fetchBlockExplorer<string>({
        asset,
        endpoint: `/tx/${txid}/hex`,
    });
};

export const broadcastToExplorer = async (
    asset: string,
    txHex: string,
): Promise<{ id: string }> => {
    const txId = await fetchBlockExplorer<string>({
        asset,
        endpoint: "/tx",
        opts: {
            method: "POST",
            body: txHex,
        },
    });

    return {
        id: txId,
    };
};

export const getSwapUTXOs = async (swap: ChainSwap | SubmarineSwap) => {
    const address =
        swap.type === SwapType.Chain
            ? (swap as ChainSwap).lockupDetails.lockupAddress
            : (swap as SubmarineSwap).address;

    const utxos = await getAddressUTXOs(swap.assetSend, address);

    const rawTxPromises = utxos.map((utxo) =>
        getRawTransaction(swap.assetSend, utxo.txid),
    );

    const rawTxs = (await Promise.all(rawTxPromises)).map((rawTx) => ({
        hex: rawTx,
    }));

    return rawTxs;
};
