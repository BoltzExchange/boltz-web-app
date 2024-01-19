import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";

const TransactionMempool = () => {
    const { t } = useGlobalContext();
    return (
        <div>
            <h2>{t("tx_in_mempool")}</h2>
            <p>{t("tx_in_mempool_subline")}</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionMempool;
