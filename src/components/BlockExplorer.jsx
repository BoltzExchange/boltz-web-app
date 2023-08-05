import { useI18n } from "@solid-primitives/i18n";
import { blockexplorer_url, blockexplorer_url_liquid } from "../config";

const blockexplorerLink = (asset, isTxId, val) => {
    const basePath =
        asset == "L-BTC" ? blockexplorer_url_liquid : blockexplorer_url;
    return `${basePath}/${isTxId ? "tx" : "address"}/${val}`;
};

const BlockExplorer = ({ asset, address, txId, typeLabel }) => {
    const [t] = useI18n();

    typeLabel = txId ? typeLabel || "claim_tx" : "lockup_address";

    return (
        <a
            class="btn btn-explorer"
            target="_blank"
            href={blockexplorerLink(
                asset,
                txId !== undefined,
                txId || address
            )}>
            {t("blockexplorer", { typeLabel: t(`blockexplorer_${typeLabel}`) })}
        </a>
    );
};

export default BlockExplorer;
