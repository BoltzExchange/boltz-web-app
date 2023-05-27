import { useI18n } from "@solid-primitives/i18n";
import { failureReason } from "../signals";
import RefundEta from "../components/RefundEta";
import DownloadRefund from "../components/DownloadRefund";

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
            <DownloadRefund />
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
