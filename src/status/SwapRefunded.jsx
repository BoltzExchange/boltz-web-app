import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { swap } from "../signals";
import { blockexplorerLink } from "../helper";

const SwapRefunded = () => {
    const [t] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <a
                class="btn btn-explorer"
                target="_blank"
                href={blockexplorerLink(swap().asset, swap().refundTx)}>
                {t("blockexplorer")}
            </a>
            <hr />
            <span class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default SwapRefunded;
