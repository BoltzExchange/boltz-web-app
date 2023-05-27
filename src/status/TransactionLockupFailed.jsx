import { useI18n } from "@solid-primitives/i18n";
import { failureReason } from "../signals";
import RefundEta from "../components/RefundEta";
import DownloadRefund from "../components/DownloadRefund";

const TransactionLockupFailed = () => {
    const [t] = useI18n();

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
