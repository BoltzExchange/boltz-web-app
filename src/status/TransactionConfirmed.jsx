import { useI18n } from "@solid-primitives/i18n";
import LoadingSpinner from "../components/LoadingSpinner";

const TransactionConfirmed = () => {
    const [t] = useI18n();

    return (
        <div>
            <h2>{t("tx_confirmed")}</h2>
            <p>{t("tx_ready_to_claim")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionConfirmed;
