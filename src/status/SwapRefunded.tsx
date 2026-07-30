import { useNavigate } from "@solidjs/router";
import { bridgeRegistry } from "boltz-swaps/bridge";
import { Show } from "solid-js";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import { getAssetNetwork } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { formatDenomination } from "../utils/denomination";
import { getRefundBridgeDetail } from "../utils/swapCreator";

const SwapRefunded = (props: { refundTxId: string }) => {
    const navigate = useNavigate();
    const { swap } = usePayContext();
    const { t, denomination } = useGlobalContext();
    const refundBridge = () => getRefundBridgeDetail(swap() ?? {});

    return (
        <div>
            <Show when={refundBridge()} fallback={<p>{t("refunded")}</p>}>
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
            <Show when={swap()}>
                {(currentSwap) => (
                    <BlockExplorer
                        asset={currentSwap().assetSend}
                        kind={BlockExplorerTargetKind.Tx}
                        id={props.refundTxId}
                        explorer={bridgeRegistry.getExplorerKind(
                            refundBridge(),
                        )}
                        typeLabel="refund_tx"
                    />
                )}
            </Show>
            <hr />
            <span class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </span>
        </div>
    );
};

export default SwapRefunded;
