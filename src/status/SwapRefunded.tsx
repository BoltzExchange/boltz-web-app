import { useNavigate } from "@solidjs/router";

import BlockExplorer from "../components/BlockExplorer";
import { SwapPosition } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { bridgeRegistry } from "../utils/bridge";

const SwapRefunded = (props: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t } = useGlobalContext();
    const preBridge = () =>
        swap().bridge?.position === SwapPosition.Pre
            ? swap().bridge
            : undefined;

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer
                asset={preBridge()?.sourceAsset ?? swap().assetSend}
                txId={props.refundTxId}
                explorer={bridgeRegistry.getExplorerKind(preBridge())}
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
