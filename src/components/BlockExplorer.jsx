import { useI18n } from "@solid-primitives/i18n";
import { blockexplorer_url, blockexplorer_url_liquid } from "../config";

const blockexplorerLink = (asset, a, isTxId) => {
    const path = isTxId ? "tx" : "address";
    if (asset == "L-BTC") {
        return `${blockexplorer_url_liquid}/${path}/${a}`;
    } else {
        return `${blockexplorer_url}/${path}/${a}`;
    }
};

const BlockExplorer = ({ asset, address, isTxId }) => {
    const [t] = useI18n();
    return (
        <a
            class="btn btn-explorer"
            target="_blank"
            href={blockexplorerLink(asset, address, isTxId)}>
            {t("blockexplorer")}
        </a>
    );
};

export default BlockExplorer;
