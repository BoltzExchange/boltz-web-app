import { prefixHex } from "../alchemy/Alchemy";
import { chooseUrl, config } from "../config";
import { NetworkTransport } from "../configs/base";
import { getNetworkTransport } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import ExternalLink from "./ExternalLink";

export enum ExplorerKind {
    Asset = "asset",
    Cctp = "cctp",
    LayerZero = "layerzero",
}

type PropsBase = {
    asset: string;
    explorer?: ExplorerKind;
    typeLabel?: "lockup_address" | "lockup_tx" | "claim_tx" | "refund_tx";
};

type PropsTxId = PropsBase & {
    txId: string;
};

type PropsAddress = PropsBase & {
    address: string;
};

const getExplorerBaseUrl = (asset: string, explorer: ExplorerKind) => {
    switch (explorer) {
        case ExplorerKind.Asset:
            return chooseUrl(config.assets[asset].blockExplorerUrl);

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
        return prefixHex(val);
    }

    return val;
};

const blockExplorerLink = (
    asset: string,
    isTxId: boolean,
    val: string,
    explorer: ExplorerKind = ExplorerKind.Asset,
) => {
    const basePath = getExplorerBaseUrl(asset, explorer);
    if (isTxId && explorer === ExplorerKind.Cctp) {
        return `${basePath}/transactions?${new URLSearchParams({
            s: val,
        }).toString()}`;
    }

    return `${basePath}/${isTxId ? "tx" : "address"}/${normalizeExplorerValue(
        asset,
        isTxId,
        val,
        explorer,
    )}`;
};

const BlockExplorer = (props: PropsTxId | PropsAddress) => {
    const { t } = useGlobalContext();

    const href = () =>
        "txId" in props && props.txId !== undefined
            ? blockExplorerLink(props.asset, true, props.txId, props.explorer)
            : blockExplorerLink(
                  props.asset,
                  false,
                  (props as PropsAddress).address,
              );

    const typeLabel = () =>
        props.typeLabel ||
        ("txId" in props && props.txId !== undefined
            ? "claim_tx"
            : "lockup_address");

    return (
        <ExternalLink class="btn btn-explorer" href={href()}>
            {t("blockexplorer", {
                typeLabel: t(`blockexplorer_${typeLabel()}`),
            })}
        </ExternalLink>
    );
};

export default BlockExplorer;
