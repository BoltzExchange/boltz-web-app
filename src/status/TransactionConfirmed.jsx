import t from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";

const TransactionConfirmed = () => {
    return (
        <div>
            <h2>{t("tx_confirmed")}</h2>
            <p>{t("tx_ready_to_claim")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionConfirmed;
