import { useI18n } from "@solid-primitives/i18n";
import { downloadRefundFile } from "../helper";
import { failureReason, swap } from "../signals";
import RefundEta from "../components/RefundEta";

const InvoiceFailedToPay = () => {
    const [t] = useI18n();

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <RefundEta />
            <span
                class="btn btn-success"
                onclick={() => downloadRefundFile(swap())}>
                {t("download_refund_json")}
            </span>
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
