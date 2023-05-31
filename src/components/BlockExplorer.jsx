import { useI18n } from "@solid-primitives/i18n";
import { blockexplorer_url, blockexplorer_url_liquid } from "../config";

const blockexplorerLink = (asset, isTxId, val) => {
    const basePath =
        asset == "L-BTC" ? blockexplorer_url_liquid : blockexplorer_url;
    return `${basePath}/${isTxId ? "tx" : "address"}/${val}`;
};

const BlockExplorer = ({ asset, address, txId }) => {
    const [t] = useI18n();

    return (
        <a
            class="btn btn-explorer"
            target="_blank"
            href={blockexplorerLink(
                asset,
                address === undefined,
                address || txId
            )}>
            {t("blockexplorer")}
        </a>
    );
};

export default BlockExplorer;
