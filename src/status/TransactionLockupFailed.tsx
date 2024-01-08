import DownloadRefund from "../components/DownloadRefund";
import RefundEta from "../components/RefundEta";
import { usePayContext } from "../context/Pay";
import t from "../i18n";

const TransactionLockupFailed = () => {
    const { failureReason } = usePayContext();
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
