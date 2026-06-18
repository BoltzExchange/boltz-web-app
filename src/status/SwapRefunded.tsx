import { useNavigate } from "@solidjs/router";
import { bridgeRegistry } from "boltz-swaps/bridge";
import { SwapPosition } from "boltz-swaps/types";
import { Show } from "solid-js";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import { getAssetNetwork } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { formatDenomination } from "../utils/denomination";

const SwapRefunded = (props: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t, denomination } = useGlobalContext();
    const preBridge = () =>
        swap()?.bridge?.position === SwapPosition.Pre
            ? swap()!.bridge
            : undefined;

    return (
        <div>
            <Show when={preBridge()} fallback={<p>{t("refunded")}</p>}>
                {(bridge) => (
                    <p>
                        {t("refunded_bridge_pending", {
                            denomination: formatDenomination(
                                denomination(),
                                bridge().sourceAsset,
                            ),
                            network:
                                getAssetNetwork(bridge().sourceAsset) ??
                                bridge().sourceAsset,
                        })}
                    </p>
                )}
            </Show>
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
