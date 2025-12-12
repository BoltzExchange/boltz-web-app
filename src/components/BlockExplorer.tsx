import { chooseUrl, config } from "../config";
import { useGlobalContext } from "../context/Global";
import ExternalLink from "./ExternalLink";

type PropsBase = {
    asset: string;
    typeLabel?: "lockup_address" | "lockup_tx" | "claim_tx" | "refund_tx";
};

type PropsTxId = PropsBase & {
    txId: string;
};

type PropsAddress = PropsBase & {
    address: string;
};

const blockExplorerLink = (asset: string, isTxId: boolean, val: string) => {
    const basePath = chooseUrl(config.assets[asset].blockExplorerUrl);
    return `${basePath}/${isTxId ? "tx" : "address"}/${val}`;
};

const BlockExplorer = (props: PropsTxId | PropsAddress) => {
    const { t } = useGlobalContext();

    const href = () =>
        "txId" in props && props.txId !== undefined
            ? blockExplorerLink(props.asset, true, props.txId)
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
