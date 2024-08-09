import { chooseUrl, config } from "../config";
import { useGlobalContext } from "../context/Global";

const blockExplorerLink = (asset: string, isTxId: boolean, val: string) => {
    const basePath = chooseUrl(config.assets[asset].blockExplorerUrl);
    return `${basePath}/${isTxId ? "tx" : "address"}/${val}`;
};

const BlockExplorer = (props: {
    asset: string;

    txId?: string;
    address?: string;
    typeLabel?: "lockup_address" | "lockup_tx" | "claim_tx" | "refund_tx";
}) => {
    const { t } = useGlobalContext();
    const href = () =>
        props.txId !== undefined
            ? blockExplorerLink(props.asset, true, props.txId)
            : blockExplorerLink(props.asset, false, props.address);
    const typeLabel = () =>
        props.typeLabel ||
        (props.txId !== undefined ? "claim_tx" : "lockup_address");

    return (
        <a class="btn btn-explorer" target="_blank" href={href()}>
            {t("blockexplorer", {
                typeLabel: t(`blockexplorer_${typeLabel()}`),
            })}
        </a>
    );
};

export default BlockExplorer;
