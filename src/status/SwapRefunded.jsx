import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { swap } from "../signals";
import { refund, mempoolLink } from "../helper";

const SwapRefunded = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
            <h2>{t("refunded")}</h2>
            <p>{t("swap_refunded")}</p>
            <hr />
            <span class="btn" onclick={() => refund(swap())}>{t("refund")}</span>
            <a class="btn btn-mempool" target="_blank" href={mempoolLink(swap().asset, swap().refundTx )}>{t("mempool")}</a>
            <hr />
            <span class="btn" onClick={(e) => navigate("/swap")}>{t("new_swap")}</span>
        </div>
    );
};

export default SwapRefunded;
