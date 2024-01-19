import DownloadRefund from "../components/DownloadRefund";
import RefundEta from "../components/RefundEta";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const TransactionLockupFailed = () => {
    const { failureReason } = usePayContext();
    const { t } = useGlobalContext();
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
