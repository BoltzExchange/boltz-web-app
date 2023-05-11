import { useI18n } from "@solid-primitives/i18n";

import {
    swap,
    failureReason,
    timeoutEta,
    timeoutBlockHeight,
} from "../signals";
import { downloadRefundFile } from "../helper";

const InvoiceFailedToPay = () => {
    const [t] = useI18n();

    return (
        <div>
            <h2>{t("lockup_failed")}</h2>
            <p>
                {t("lockup_failed_reason")}: {failureReason()}
            </p>
            <p>
                {t("timeout_eta")}: {new Date(timeoutEta()).toLocaleString()}{" "}
                <br />
                {t("pay_timeout_blockheight")}: {timeoutBlockHeight()}
            </p>
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
