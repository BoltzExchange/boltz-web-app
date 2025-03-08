import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createSignal, onMount } from "solid-js";

import SwapList from "../components/SwapList";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { SwapType } from "../consts/Enums";
import { swapStatusFailed, swapStatusPending } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import "../style/tabs.scss";
import { fetchUTXOsWithFailover } from "../utils/blockchain";
import { getLockupTransaction, getSwapStatus } from "../utils/boltzClient";
import { SomeSwap, SubmarineSwap } from "../utils/swapCreator";
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

        const swapsWithUTXO = (
            await Promise.all(
                allSwaps.filter(refundSwapsSanityFilter).map(async (swap: SubmarineSwap) => {
                    const utxos = await fetchUTXOsWithFailover(
                        swap.assetSend,
                        swap.address,
                    );
                    if (utxos.length > 0) {
                        return swap;
                    }
                    return null;
                }),
            )
        ).filter((swap) => swap !== null);

        const swapsToRefund = swapsWithUTXO.filter(
            (swap) => swapStatusFailed.TransactionLockupFailed === swap.status,
        );
        setRefundableSwaps(swapsToRefund);

        void allSwaps
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swap.status !== swapStatusPending.SwapCreated &&
                    swap.status !== swapStatusPending.InvoicePending &&
                    swapsToRefund.find((found) => found.id === swap.id) ===
                        undefined,
            )
            // eslint-disable-next-line solid/reactivity
            .map(async (swap: SubmarineSwap) => {
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
                    const utxos = await fetchUTXOsWithFailover(
                        swap.assetSend,
                        swap.address,
                    );
                    if (utxos.length > 0) {
                        addToRefundableSwaps(swap);
                        return;
                    }
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
