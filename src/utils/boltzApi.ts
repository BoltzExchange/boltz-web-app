import { config } from "../config";
import { BTC } from "../consts";
import type {
    Contracts,
    NodeInfo,
    Pairs,
    ReversePairsTaproot,
    SubmarinePairsTaproot,
} from "./types";

export const getApiUrl = (asset: string): string => {
    const found = config().assets[asset];
    if (found && found.apiUrl) {
        return found.apiUrl;
    }

    return config().apiUrl;
};
export const fetcher = async <T = any>(
    url: string,
    asset: string = BTC,
    params: any | undefined = null,
): Promise<T> => {
    let opts = {};
    if (params) {
        opts = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        };
    }
    const apiUrl = getApiUrl(asset) + url;
    console.log(apiUrl, url);
    const response = await fetch(apiUrl, opts);
    if (!response.ok) {
        return Promise.reject(response);
    }
    return response.json();
};
export const getPairs = async (asset: string): Promise<Pairs> => {
    const [submarine, reverse] = await Promise.all([
        fetcher<SubmarinePairsTaproot>("/v2/swap/submarine", asset),
        fetcher<ReversePairsTaproot>("/v2/swap/reverse", asset),
    ]);

    return {
        reverse,
        submarine,
    };
};
export const getSwapStatus = (asset: string, id: string) =>
    fetcher<{
        status: string;
        failureReason?: string;
        zeroConfRejected?: boolean;
        transaction?: {
            id: string;
            hex: string;
        };
    }>(`/v2/swap/${id}`, asset);
export const getNodes = (asset: string) =>
    fetcher<{
        BTC: {
            LND: NodeInfo;
            CLN: NodeInfo;
        };
    }>("/v2/nodes", asset);
export const getNodeStats = (asset: string) =>
    fetcher<{
        BTC: {
            total: {
                capacity: number;
                channels: number;
                peers: number;
                oldestChannel: number;
            };
        };
    }>("/v2/nodes/stats", asset);

export const getSubmarineTransaction = (asset: string, id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
        timeoutEta?: number;
    }>(`/v2/swap/submarine/${id}/transaction`, asset);
export const getReverseTransaction = (asset: string, id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
    }>(`/v2/swap/reverse/${id}/transaction`, asset);
export const getContracts = (asset: string) =>
    fetcher<Record<string, Contracts>>("/v2/chain/contracts", asset);
