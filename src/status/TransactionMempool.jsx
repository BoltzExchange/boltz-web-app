import t from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";

const TransactionMempool = () => {
    return (
        <div>
            <h2>{t("tx_in_mempool")}</h2>
            <p>{t("tx_in_mempool_subline")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionMempool;
