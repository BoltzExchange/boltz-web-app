import { type Accessor, Show, createSignal } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";
import SwapRefunded from "./SwapRefunded";

const InvoiceFailedToPay = () => {
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={refundTxId() === ""}>
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                    setRefundTxId={setRefundTxId}
                />
            </Show>
            <Show when={refundTxId() !== ""}>
                <SwapRefunded refundTxId={refundTxId()} />
            </Show>
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
