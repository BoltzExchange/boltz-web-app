import { Show } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const InvoicePending = () => {
    const { t } = useGlobalContext();
    const { swap, swapStatusTransaction } = usePayContext();
    return (
        <div>
            <p>{t("invoice_pending")}</p>
            <LoadingSpinner />
            <Show when={swapStatusTransaction()}>
                <BlockExplorer
                    asset={swap().assetSend}
                    txId={swapStatusTransaction().id}
                    typeLabel="lockup_tx"
                />
            </Show>
        </div>
    );
};

export default InvoicePending;
