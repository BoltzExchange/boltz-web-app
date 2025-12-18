import { useNavigate } from "@solidjs/router";
import { type Accessor, Show, createSignal } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";
import SwapRefunded from "./SwapRefunded";

const SwapExpired = () => {
    const navigate = useNavigate();
    const { failureReason, swap, refundableUTXOs } = usePayContext();
    const { t } = useGlobalContext();
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    return (
        <div>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={refundableUTXOs().length > 0 && refundTxId() === ""}>
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                    setRefundTxId={setRefundTxId}
                />
                <hr />
            </Show>
            <Show when={refundTxId() !== ""}>
                <SwapRefunded refundTxId={refundTxId()} />
                <hr />
            </Show>
            <button class="btn" onClick={() => navigate("/swap")}>
                {t("new_swap")}
            </button>
        </div>
    );
};

export default SwapExpired;
