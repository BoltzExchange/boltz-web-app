import { useNavigate } from "@solidjs/router";
import { Show, createResource, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/Pagination";
import SwapList, { type Swap, sortSwaps } from "../components/SwapList";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { type tFn, useGlobalContext } from "../context/Global";
import "../style/tabs.scss";
import { isMobile } from "../utils/helper";
import { RescueAction, createRescueList } from "../utils/rescue";
import type { SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import ErrorWasm from "./ErrorWasm";

const swapsPerPage = 10;

export const rescueListAction = ({ t, swap }: { t: tFn; swap: Swap }) => {
    switch (swap.action) {
        case RescueAction.Pending:
            return t("in_progress");
        case RescueAction.Claim:
            return t("claim");
        case RescueAction.Refund:
            return t("refund");
        case RescueAction.None:
        default:
            return t("completed");
    }
};

const Rescue = () => {
    const navigate = useNavigate();
    const { getSwaps, wasmSupported, t } = useGlobalContext();

    const [currentPage, setCurrentPage] = createSignal(1);
    const [currentSwaps, setCurrentSwaps] = createSignal<SomeSwap[]>([]);
    const [loading, setLoading] = createSignal(false);

    const [allSwaps] = createResource(
        currentPage,
        async () => await getSwaps(),
    );

    const [refundList] = createResource(
        currentSwaps,
        async (swaps: SomeSwap[]) => {
            setLoading(true);
            return await createRescueList(swaps).finally(() =>
                setLoading(false),
            );
        },
    );

    const getListHeight = () => ({
        // to avoid layout shift when swapping between pages with less than 5 swaps
        "min-height":
            allSwaps()?.length > swapsPerPage ? `${45 * swapsPerPage}px` : "0",
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame refund" data-testid="refundFrame">
                    <header>
                        <SettingsCog />
                        <h2>{t("rescue_swap")}</h2>
                    </header>
                    <Show
                        when={allSwaps()?.length > 0}
                        fallback={
                            <>
                                <p>{t("no_rescuable_swaps")}</p>
                                <hr />
                            </>
                        }>
                        <div style={!isMobile() ? getListHeight() : null}>
                            <Show
                                when={!loading()}
                                fallback={
                                    <div class="center" style={getListHeight()}>
                                        <LoadingSpinner />
                                    </div>
                                }>
                                <SwapList
                                    swapsSignal={refundList}
                                    action={(swap) => {
                                        return rescueListAction({ t, swap });
                                    }}
                                    hideDateOnMobile
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
                            itemsPerPage={swapsPerPage}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                        />
                        <hr />
                    </Show>
                    <h4>{t("cant_find_swap")}</h4>
                    <p>{t("rescue_external_explainer")}</p>
                    <button
                        class="btn"
                        onClick={() => navigate(`/rescue/external`)}>
                        {t("rescue_external_swap")}
                    </button>
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default Rescue;
