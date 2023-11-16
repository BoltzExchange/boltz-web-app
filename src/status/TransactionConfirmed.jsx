import LoadingSpinner from "../components/LoadingSpinner";
import t from "../i18n";

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
