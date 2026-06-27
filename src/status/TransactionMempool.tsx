import { SwapType } from "boltz-swaps/types";
import { type Accessor, Show } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { SomeSwap } from "../utils/swapCreator";
import Broadcasting from "./Broadcasting";

const TransactionMempool = (props: { swap: Accessor<SomeSwap | null> }) => {
    const { t } = useGlobalContext();
    const { isSwapClaiming } = usePayContext();

    const claimingNow = () => {
        const currentSwap = props.swap();
        return (
            currentSwap !== null &&
            (isSwapClaiming(currentSwap.id) ||
                currentSwap.claimTx !== undefined)
        );
    };

    return (
        <Show when={!claimingNow()} fallback={<Broadcasting />}>
            <div>
                <h2>{t("tx_in_mempool")}</h2>
                <p>{t("tx_in_mempool_subline")}</p>
                <Show when={props.swap()?.type === SwapType.Chain}>
                    <h3>{t("tx_in_mempool_warning")}</h3>
                </Show>
                <LoadingSpinner />
            </div>
        </Show>
    );
};

export default TransactionMempool;
