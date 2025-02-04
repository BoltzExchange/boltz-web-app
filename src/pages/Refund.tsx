import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createSignal, onMount } from "solid-js";

import SwapList from "../components/SwapList";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { SwapType } from "../consts/Enums";
import { swapStatusFailed, swapStatusSuccess } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import "../style/tabs.scss";
import { getLockupTransaction, getSwapStatus } from "../utils/boltzClient";
import { SomeSwap } from "../utils/swapCreator";
import ErrorWasm from "./ErrorWasm";

const Refund = () => {
    const navigate = useNavigate();
    const { getSwaps, updateSwapStatus, wasmSupported, t } = useGlobalContext();

    const refundSwapsSanityFilter = (swap: SomeSwap) =>
        swap.type !== SwapType.Reverse && swap.refundTx === undefined;

    const [refundableSwaps, setRefundableSwaps] = createSignal<SomeSwap[]>([]);

    onMount(async () => {
        const addToRefundableSwaps = (swap: SomeSwap) => {
            setRefundableSwaps(refundableSwaps().concat(swap));
        };

        const allSwaps = await getSwaps();

        const swapsToRefund = allSwaps
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swapStatusFailed.TransactionLockupFailed === swap.status,
            );
        setRefundableSwaps(swapsToRefund);

        void allSwaps
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swap.status !== swapStatusSuccess.TransactionClaimed &&
                    swapsToRefund.find((found) => found.id === swap.id) ===
                        undefined,
            )
            // eslint-disable-next-line solid/reactivity
            .map(async (swap) => {
                try {
                    const res = await getSwapStatus(swap.id);
                    if (
                        !(await updateSwapStatus(swap.id, res.status)) &&
                        Object.values(swapStatusFailed).includes(res.status)
                    ) {
                        // Make sure coins were locked for the swaps with status "swap.expired" or "swap.failedToPay"
                        await getLockupTransaction(swap.id, swap.type);
                        addToRefundableSwaps(swap);
                    }
                } catch (e) {
                    log.warn("failed to get swap status", swap.id, e);
                }
            });
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame" data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2>{t("refund_swap")}</h2>
                    </header>
                    <Show
                        when={refundableSwaps().length > 0}
                        fallback={
                            <>
                                <p>{t("no_refundable_swaps")}</p>
                                <hr />
                            </>
                        }>
                        <SwapList
                            swapsSignal={refundableSwaps}
                            action={t("refund")}
                        />
                    </Show>
                    <h4>{t("cant_find_swap")}</h4>
                    <p>{t("refund_external_explainer")}</p>
                    <button
                        class="btn"
                        onClick={() => navigate(`/refund/external`)}>
                        {t("refund_external_swap")}
                    </button>
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default Refund;
