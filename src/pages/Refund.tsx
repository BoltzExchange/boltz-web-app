import { useNavigate } from "@solidjs/router";
import { Show, createResource, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/Pagination";
import SwapList, { sortSwaps } from "../components/SwapList";
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

const SWAPS_PER_PAGE = 5;

const Refund = () => {
    const navigate = useNavigate();
    const { getSwaps, updateSwapStatus, wasmSupported, t } = useGlobalContext();

    const [currentPage, setCurrentPage] = createSignal(1);
    const [currentSwaps, setCurrentSwaps] = createSignal<SomeSwap[]>([]);
    const [loading, setLoading] = createSignal(false);

    const [allSwaps] = createResource(
        currentPage,
        async () => await getSwaps(),
    );

    const [swapList] = createResource(
        currentSwaps,
        async (swaps: SubmarineSwap[]) => {
            setLoading(true);
            return await Promise.all(
                swaps.map(async (swap) => {
                    if (
                        (swap.type === SwapType.Reverse &&
                            swap.refundTx !== undefined) ||
                        swap.status === swapStatusPending.SwapCreated ||
                        swap.status === swapStatusPending.InvoicePending
                    ) {
                        return { ...swap, disabled: true };
                    }

                    try {
                        const res = await getSwapStatus(swap.id);

                        if (
                            !(await updateSwapStatus(swap.id, res.status)) &&
                            Object.values(swapStatusFailed).includes(res.status)
                        ) {
                            // Make sure coins were locked for the swaps with status "swap.expired" or "swap.failedToPay"
                            await getLockupTransaction(swap.id, swap.type);

                            const utxos = await fetchUTXOsWithFailover(
                                swap.assetSend,
                                swap.address,
                            );

                            if (utxos.length > 0) {
                                return swap;
                            }
                        }

                        return { ...swap, disabled: true };
                    } catch {
                        try {
                            const utxos = await fetchUTXOsWithFailover(
                                swap.assetSend,
                                swap.address,
                            );

                            if (utxos.length > 0) {
                                return swap;
                            }
                        } catch {
                            return { ...swap, disabled: true };
                        }
                    }
                    return { ...swap, disabled: true };
                }),
            ).finally(() => setLoading(false));
        },
    );

    const getListHeight = () => ({
        // to avoid layout shift when swapping between pages with less than 5 swaps
        "min-height":
            allSwaps()?.length > SWAPS_PER_PAGE
                ? `${45 * SWAPS_PER_PAGE}px`
                : "0",
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame refund" data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2>{t("refund_swap")}</h2>
                    </header>
                    <Show
                        when={allSwaps()?.length > 0}
                        fallback={
                            <>
                                <p>{t("no_refundable_swaps")}</p>
                                <hr />
                            </>
                        }>
                        <div style={getListHeight()}>
                            <Show
                                when={!loading()}
                                fallback={
                                    <div class="center" style={getListHeight()}>
                                        <LoadingSpinner />
                                    </div>
                                }>
                                <SwapList
                                    swapsSignal={swapList}
                                    action={(swap) =>
                                        swap.disabled
                                            ? t("no_refund_due")
                                            : t("refund")
                                    }
                                />
                            </Show>
                        </div>
                        <Pagination
                            items={allSwaps}
                            setDisplayedItems={(swaps: SubmarineSwap[]) =>
                                setCurrentSwaps(swaps)
                            }
                            sort={sortSwaps}
                            totalItems={allSwaps().length}
                            itemsPerPage={SWAPS_PER_PAGE}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                        />
                        <hr />
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
