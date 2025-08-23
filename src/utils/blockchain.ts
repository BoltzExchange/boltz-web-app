import log from "loglevel";

import { chooseUrl, config } from "../config";
import { Explorer } from "../configs/base";
import { BTC, LBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { formatError } from "./errors";
import { requestTimeoutDuration } from "./helper";
import type { ChainSwap, SubmarineSwap } from "./swapCreator";

export type UTXO = {
    txid: string;
    vout: number;
};

const getExplorerApi = (asset: string, explorerId: Explorer) => {
    return config.assets[asset].blockExplorerApis.find(
        (url) => url.id === explorerId,
    );
};

const handleResponseSuccess = async <T>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
    }
    return (await response.text()) as T;
};

const handleResponseError = async (response: Response) => {
    const errorMessage = `HTTP ${response.status} from ${response.url}`;
    try {
        const body = await response.json();
        throw new Error(`${errorMessage}: ${formatError(body)}`);
    } catch {
        throw new Error(errorMessage);
    }
};

const constructRequestOptions = (options: RequestInit = {}) => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort(),
        requestTimeoutDuration,
    );

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

            return await handleResponseSuccess<T>(res);
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
        const parallelPromises = urls.map(async (url) => {
            const { opts, requestTimeout } = constructRequestOptions(options);
            try {
                const basePath = chooseUrl(url);

                const res = await fetch(`${basePath}${endpoint}`, opts);

                if (!res.ok) {
                    await handleResponseError(res);
                }

                return res;
            } finally {
                clearTimeout(requestTimeout);
            }
        });

        const response = await Promise.any(parallelPromises);

        return await handleResponseSuccess<T>(response);
    } catch (err) {
        if (err instanceof AggregateError) {
            err.errors.forEach((e, i) => {
                log.error(
                    `fetch to external explorer ${chooseUrl(urls[i])} failed: ${e}`,
                );
            });
        }
        throw new Error(`all external fetch attempts to ${endpoint} failed`);
    }
};

const getAddressUTXOs = async (asset: string, address: string) => {
    return await fetchBlockExplorer<UTXO[]>(asset, `/address/${address}/utxo`);
};

const getRawTransaction = async (asset: string, txid: string) => {
    return await fetchBlockExplorer<string>(asset, `/tx/${txid}/hex`);
};

export const getBlockTipHeight = async (asset: string) => {
    const height = await fetchBlockExplorer<string>(
        asset,
        "/blocks/tip/height",
    );

    if (!Number.isFinite(Number(height))) {
        throw new Error(
            `invalid block tip height for asset ${asset}: ${height}`,
        );
    }

    return height;
};

const getEsploraFeeEstimations = async (asset: string) => {
    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const esploraApi = getExplorerApi(asset, Explorer.Esplora);

        if (!esploraApi) {
            throw new Error(`no esplora API found for asset ${asset}`);
        }

        const endpoint = `${chooseUrl(esploraApi)}/fee-estimates`;

        const res = await fetch(endpoint, opts);

        if (!res.ok) {
            await handleResponseError(res);
        }

        return (await res.json()) as Record<string, number>;
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getMempoolFeeEstimations = async (asset: string) => {
    type MempoolFeeEstimation = Record<
        "fastestFee" | "halfHourFee" | "hourFee" | "economyFee" | "minimumFee",
        number
    >;

    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const mempoolApi = getExplorerApi(asset, Explorer.Mempool);

        if (!mempoolApi) {
            throw new Error(`no mempool API found for asset ${asset}`);
        }

        const endpoint = `${chooseUrl(mempoolApi)}/v1/fees/recommended`;

        const res = await fetch(endpoint, opts);

        if (!res.ok) {
            await handleResponseError(res);
        }

        return (await res.json()) as MempoolFeeEstimation;
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getExplorerFeeEstimations = async (asset: string) => {
    try {
        log.info(`falling back to Mempool fee estimations`);
        const feeEstimations = await getMempoolFeeEstimations(asset);

        return feeEstimations.halfHourFee;
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Mempool API for ${asset}: ${e}`,
        );
    }

    try {
        log.info(`falling back to Esplora fee estimations`);
        const feeEstimations = await getEsploraFeeEstimations(asset);

        const expectedBlocksToConfirm = "3";

        return feeEstimations[expectedBlocksToConfirm];
    } catch (e) {
        log.warn(
            `failed to get fee estimations via Esplora API for ${asset}: ${e}`,
        );
        throw new Error(`could not get fee estimations for ${asset}`);
    }
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

    const rawTxs: string[] = [];

    for (const utxo of utxos) {
        const rawTx = await getRawTransaction(swap.assetSend, utxo.txid);
        rawTxs.push(rawTx);
    }

    return rawTxs.map((rawTx) => {
        if ([BTC, LBTC].includes(swap.assetSend)) {
            return {
                hex: rawTx,
                // Important to know if the swap has timed out or not
                timeoutBlockHeight:
                    swap.type === SwapType.Chain
                        ? (swap as ChainSwap).lockupDetails.timeoutBlockHeight
                        : (swap as SubmarineSwap).timeoutBlockHeight,
            };
        }

        return { hex: rawTx };
    });
};
