import { useNavigate } from "@solidjs/router";

import BlockExplorer from "../components/BlockExplorer";
import { usePayContext } from "../context/Pay";
import t from "../i18n";

const SwapRefunded = () => {
    const navigate = useNavigate();
    const { swap } = usePayContext();

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
