import log from "loglevel";

import { chooseUrl, config } from "../config";
import { Explorer, type ExplorerUrl, type Url } from "../configs/base";
import {
    BTC,
    LBTC,
    type RefundableAssetType,
    refundableAssets,
} from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { formatError } from "./errors";
import { requestTimeoutDuration } from "./helper";
import type { ChainSwap, SubmarineSwap } from "./swapCreator";

export type UTXO = {
    txid: string;
    vout: number;
};

type MempoolFeeEstimation = Record<
    "fastestFee" | "halfHourFee" | "hourFee" | "economyFee" | "minimumFee",
    number
>;

export const blockTimeMinutes: Record<RefundableAssetType, number> = {
    [BTC]: 10,
    [LBTC]: 1,
};

export const getNetworkName = (asset: string) => {
    switch (asset) {
        case BTC:
            return "Bitcoin";
        case LBTC:
            return "Liquid";
        default:
            return "";
    }
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
        () => controller.abort({ reason: "Request timed out" }),
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
        if (refundableAssets.includes(swap.assetSend)) {
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

const getEsploraFeeEstimations = async (apiEndpoint: Url) => {
    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const res = await fetch(
            `${chooseUrl(apiEndpoint)}/fee-estimates`,
            opts,
        );

        if (!res.ok) {
            await handleResponseError(res);
        }

        return ((await res.json()) as Record<string, number>)[3];
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getMempoolFeeEstimations = async (mempoolApi: Url) => {
    const { opts, requestTimeout } = constructRequestOptions();
    try {
        const res = await fetch(
            `${chooseUrl(mempoolApi)}/v1/fees/recommended`,
            opts,
        );

        if (!res.ok) {
            await handleResponseError(res);
        }

        return ((await res.json()) as MempoolFeeEstimation).halfHourFee;
    } finally {
        clearTimeout(requestTimeout);
    }
};

export const getFeeEstimations = async (url: ExplorerUrl) => {
    switch (url.id) {
        case Explorer.Mempool:
            return await getMempoolFeeEstimations(url);
        case Explorer.Esplora:
            return await getEsploraFeeEstimations(url);
        default:
            throw new Error(`unknown explorer type: ${url.id}`);
    }
};
