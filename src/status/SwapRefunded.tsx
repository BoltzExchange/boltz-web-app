import { useNavigate } from "@solidjs/router";

import BlockExplorer from "../components/BlockExplorer";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const SwapRefunded = ({ refundTxId }: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { asset } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer
                asset={asset()}
                txId={refundTxId}
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
