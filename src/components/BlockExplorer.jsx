import { useI18n } from "@solid-primitives/i18n";
import { pairs } from "../config";

const blockExplorerLink = (asset, isTxId, val) => {
    const basePath = pairs[`${asset}/BTC`].blockExplorerUrl;
    return `${basePath}/${isTxId ? "tx" : "address"}/${val}`;
};

const BlockExplorer = ({ asset, address, txId, typeLabel }) => {
    const [t] = useI18n();

    const href =
        txId !== undefined
            ? blockExplorerLink(asset, true, txId)
            : blockExplorerLink(asset, false, address);
    typeLabel =
        typeLabel || (txId !== undefined ? "claim_tx" : "lockup_address");

    return (
        <a class="btn btn-explorer" target="_blank" href={href}>
            {t("blockexplorer", { typeLabel: t(`blockexplorer_${typeLabel}`) })}
        </a>
    );
};

export default BlockExplorer;
