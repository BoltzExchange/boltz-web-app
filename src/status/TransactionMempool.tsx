import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const TransactionMempool = () => {
    const { t } = useGlobalContext();
    const { swap, swapStatusTransaction } = usePayContext();
    return (
        <div>
            <h2>{t("tx_in_mempool")}</h2>
            <p>{t("tx_in_mempool_subline")}</p>
            <LoadingSpinner />
            <BlockExplorer
                asset={swap().assetSend}
                txId={swapStatusTransaction()?.id}
                typeLabel="lockup_tx"
            />
        </div>
    );
};

export default TransactionMempool;
