import { Show } from "solid-js";
import type { Accessor } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { isMobile } from "../utils/helper";
import type { SomeSwap } from "../utils/swapCreator";

const TransactionMempool = (props: { swap: Accessor<SomeSwap> }) => {
    const { t } = useGlobalContext();

    return (
        <div>
            <h2>{t("tx_in_mempool")}</h2>
            <p>{t("tx_in_mempool_subline")}</p>
            <Show
                when={
                    isMobile() &&
                    [SwapType.Chain, SwapType.Reverse].includes(
                        props.swap().type,
                    )
                }>
                <h3>{t("tx_in_mempool_warning")}</h3>
            </Show>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionMempool;
