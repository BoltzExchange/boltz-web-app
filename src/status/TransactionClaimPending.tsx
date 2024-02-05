import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";

const TransactionClaimPending = () => {
    const { t } = useGlobalContext();
    return (
        <div>
            <h2>{t("invoice_paid")}</h2>
            <p>{t("creating_coop_claim")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionClaimPending;
