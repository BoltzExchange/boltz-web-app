import { type Accessor, Show } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";
import SwapRefunded from "./SwapRefunded";

const InvoiceFailedToPay = () => {
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={swap()?.refundTx === undefined}>
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                />
            </Show>
            <Show when={swap()?.refundTx !== undefined}>
                <SwapRefunded refundTxId={swap().refundTx} />
            </Show>
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
