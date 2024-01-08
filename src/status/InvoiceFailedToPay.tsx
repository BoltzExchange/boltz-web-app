import { Show } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { RBTC } from "../consts";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const InvoiceFailedToPay = () => {
    const { failureReason, swap, timeoutEta } = usePayContext();
    const { t } = useGlobalContext();
    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={!timeoutEta()} fallback={<RefundEta />}>
                <RefundButton swap={swap} />
            </Show>
            <Show when={swap().asset !== RBTC}>
                <DownloadRefund />
            </Show>
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
