import { useNavigate } from "@solidjs/router";
import { bridgeRegistry } from "boltz-swaps/bridge";
import { SwapPosition } from "boltz-swaps/types";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const SwapRefunded = (props: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t } = useGlobalContext();
    const preBridge = () =>
        swap()?.bridge?.position === SwapPosition.Pre
            ? swap()!.bridge
            : undefined;

    return (
        <div>
            <p>{t("refunded")}</p>
            <hr />
            <BlockExplorer
                asset={preBridge()?.sourceAsset ?? swap()!.assetSend}
                kind={BlockExplorerTargetKind.Tx}
                id={props.refundTxId}
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
