import LoadingSpinner from "../components/LoadingSpinner";
import t from "../i18n";

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
