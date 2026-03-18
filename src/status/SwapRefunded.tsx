import { useNavigate } from "@solidjs/router";

import BlockExplorer from "../components/BlockExplorer";
import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { OftPosition } from "../utils/swapCreator";

const SwapRefunded = (props: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t } = useGlobalContext();
    const isPreOft = () => swap().oft?.position === OftPosition.Pre;

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer
                asset={isPreOft() ? swap().oft.sourceAsset : swap().assetSend}
                txId={props.refundTxId}
                href={
                    isPreOft()
                        ? `${config.layerZeroExplorerUrl}/tx/${props.refundTxId}`
                        : undefined
                }
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
