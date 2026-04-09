import { useNavigate } from "@solidjs/router";

import BlockExplorer, { ExplorerKind } from "../components/BlockExplorer";
import { SwapPosition } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const SwapRefunded = (props: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t } = useGlobalContext();
    const isPreOft = () => swap().oft?.position === SwapPosition.Pre;

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer
                asset={isPreOft() ? swap().oft.sourceAsset : swap().assetSend}
                txId={props.refundTxId}
                explorer={isPreOft() ? ExplorerKind.LayerZero : undefined}
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
