import { useI18n } from "@solid-primitives/i18n";
import { blockexplorerLink } from '../helper';

const BlockExplorer = ({ asset, transactionId }) => {
    const [t] = useI18n();

    return (
        <a
            class="btn btn-explorer"
            target="_blank"
            href={blockexplorerLink(asset, transactionId)}>
            {t("blockexplorer")}
        </a>
    )
};

export default BlockExplorer;
