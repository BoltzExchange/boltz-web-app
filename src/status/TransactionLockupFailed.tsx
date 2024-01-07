import DownloadRefund from "../components/DownloadRefund";
import RefundEta from "../components/RefundEta";
import t from "../i18n";
import { failureReason } from "../signals";

const TransactionLockupFailed = () => {
    return (
        <div>
            <h2>{t("lockup_failed")}</h2>
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

export default TransactionLockupFailed;
