import { useNavigate } from "@solidjs/router";

import BlockExplorer from "../components/BlockExplorer";
import t from "../i18n";
import { swap } from "../signals";

const SwapRefunded = () => {
    const navigate = useNavigate();

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer
                asset={swap().asset}
                txId={swap().refundTx}
                typeLabel="refund_tx"
            />
            <hr />
            <span class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default SwapRefunded;
