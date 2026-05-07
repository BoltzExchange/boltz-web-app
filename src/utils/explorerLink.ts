import { chooseUrl, config } from "../config";
import { NetworkTransport } from "../configs/base";
import { getNetworkTransport } from "../consts/Assets";
import { prefix0x } from "./evmTransaction";

export enum ExplorerKind {
    Asset = "asset",
    Cctp = "cctp",
    LayerZero = "layerzero",
}

const getExplorerBaseUrl = (
    asset: string,
    explorer: ExplorerKind,
): string | undefined => {
    switch (explorer) {
        case ExplorerKind.Asset:
            return chooseUrl(config.assets?.[asset]?.blockExplorerUrl);

        case ExplorerKind.LayerZero:
            return config.layerZeroExplorerUrl;

        case ExplorerKind.Cctp:
            return config.cctpExplorerUrl;
    }
};

const normalizeExplorerValue = (
    asset: string,
    isTxId: boolean,
    val: string,
    explorer: ExplorerKind,
): string => {
    if (
        isTxId &&
        explorer === ExplorerKind.LayerZero &&
        getNetworkTransport(asset) === NetworkTransport.Tron
    ) {
        return prefix0x(val);
    }

    return val;
};

const encodeExplorerUrl = (
    baseUrl: string,
    path: string,
    params?: Record<string, string>,
): string => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return `${baseUrl}/${path}${query}`;
};

export const blockExplorerLink = (
    asset: string,
    isTxId: boolean,
    val: string,
    explorer: ExplorerKind = ExplorerKind.Asset,
): string | undefined => {
    const basePath = getExplorerBaseUrl(asset, explorer);
    if (basePath === undefined) {
        return undefined;
    }
    if (isTxId && explorer === ExplorerKind.Cctp) {
        return encodeExplorerUrl(basePath, "messages", {
            transactionHash: val,
        });
    }

    return encodeExplorerUrl(
        basePath,
        `${isTxId ? "tx" : "address"}/${normalizeExplorerValue(
            asset,
            isTxId,
            val,
            explorer,
        )}`,
    );
};
