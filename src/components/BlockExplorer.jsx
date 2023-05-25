import { useI18n } from "@solid-primitives/i18n";
import { blockexplorer_url, blockexplorer_url_liquid } from "../config";

const blockexplorerLink = (asset, a) => {
    if (asset == "L-BTC") {
        return `${blockexplorer_url_liquid}/address/${a}`;
    } else {
        return `${blockexplorer_url}/address/${a}`;
    }
};

const BlockExplorer = ({ asset, address }) => {
    const [t] = useI18n();

    return (
        <a
            class="btn btn-explorer"
            target="_blank"
            href={blockexplorerLink(asset, address)}>
            {t("blockexplorer")}
        </a>
    );
};

export default BlockExplorer;
