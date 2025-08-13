import log from "loglevel";

import { chooseUrl, config } from "../config";
import { SwapType } from "../consts/Enums";
import { formatError } from "./errors";
import type { ChainSwap, SubmarineSwap } from "./swapCreator";

export type UTXO = {
    txid: string;
    vout: number;
};

const processResponse = async <T>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
    }
    return (await response.text()) as T;
};

const constructRequestOptions = (options: RequestInit) => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 10_000);

    const opts: RequestInit = {
        signal: controller.signal, // Default abort signal, can be overridden by options.signal
        ...options,
    };

    return { opts, requestTimeout };
};

/**
 * Sequentially fetches resources from block explorers APIs and returns the response
 */
const fetchBlockExplorer = async <T>(
    asset: string,
    endpoint: string,
    options: RequestInit = {},
): Promise<T> => {
    for (const url of config.assets[asset].blockExplorerApis) {
        const { opts, requestTimeout } = constructRequestOptions(options);

        try {
            const basePath = chooseUrl(url);

            const res = await fetch(`${basePath}${endpoint}`, opts);

            if (!res.ok) {
                try {
                    const body = await res.json();
                    log.error(
                        `block explorer fetch ${endpoint} for asset ${asset} failed`,
                        formatError(body),
                    );
                    continue;
                } catch {
                    // If parsing JSON fails, throw a generic error with status text
                    log.error(
                        `block explorer fetch ${endpoint} for asset ${asset} failed`,
                        res.statusText,
                    );
                    continue;
                }
            }

            return await processResponse<T>(res);
        } catch (e) {
            log.error(
                `block explorer fetch ${endpoint} for asset ${asset} failed`,
                e,
            );
            continue;
        } finally {
            clearTimeout(requestTimeout);
        }
    }

    throw new Error(
        `all block explorer APIs failed for asset ${asset}, endpoint ${endpoint}`,
    );
};

/**
 * Fetches resources from multiple block explorer APIs in parallel and returns the first successful response
 */
const fetchBlockExplorerParallel = async <T>(
    asset: string,
    endpoint: string,
    options: RequestInit = {},
): Promise<T> => {
    const urls = config.assets[asset].blockExplorerApis;

    try {
        const broadcastPromises = urls.map(async (url) => {
            const { opts, requestTimeout } = constructRequestOptions(options);
            try {
                const basePath = chooseUrl(url);

                const res = await fetch(`${basePath}${endpoint}`, opts);

                if (!res.ok) {
                    throw new Error(
                        `HTTP ${res.status} from ${basePath}${endpoint}`,
                    );
                }

                return res;
            } finally {
                clearTimeout(requestTimeout);
            }
        });

        const response = await Promise.any(broadcastPromises);

        return await processResponse<T>(response);
    } catch (err) {
        if (err instanceof AggregateError) {
            err.errors.forEach((e, i) => {
                log.error(`Broadcast to ${chooseUrl(urls[i])} failed: ${e}`);
            });
        }
        throw new Error(`all ${asset} transaction broadcast attempts failed`, {
            cause: err,
        });
    }
};

const getAddressUTXOs = async (asset: string, address: string) => {
    return await fetchBlockExplorer<UTXO[]>(asset, `/address/${address}/utxo`);
};

const getRawTransaction = async (asset: string, txid: string) => {
    return await fetchBlockExplorer<string>(asset, `/tx/${txid}/hex`);
};

export const broadcastToExplorer = async (
    asset: string,
    txHex: string,
): Promise<{ id: string }> => {
    const txId = await fetchBlockExplorerParallel<string>(asset, "/tx", {
        method: "POST",
        body: txHex,
    });

    return { id: txId };
};

export const getSwapUTXOs = async (swap: ChainSwap | SubmarineSwap) => {
    const address =
        swap.type === SwapType.Chain
            ? (swap as ChainSwap).lockupDetails.lockupAddress
            : (swap as SubmarineSwap).address;

    const utxos = await getAddressUTXOs(swap.assetSend, address);

    const rawTxs: { hex: string }[] = [];

    for (const utxo of utxos) {
        const rawTx = await getRawTransaction(swap.assetSend, utxo.txid);
        rawTxs.push({
            hex: rawTx,
        });
    }

    return rawTxs;
};
