import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import { swap, failureReason } from "../signals";
import { downloadRefundFile, downloadRefundQr } from "../helper";

const InvoiceFailedToPay = () => {
    const [t, { add, locale, dict }] = useI18n();

    const navigate = useNavigate();

    return (
        <div>
           <h2>{t("lockup_failed")}</h2>
           <p>{t("lockup_failed_reason")}: {failureReason()}</p>
           SHOW ETA
           <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
           <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
           <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
