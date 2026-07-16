import { useNavigate } from "@solidjs/router";
import { Show, createResource, createSignal, onMount } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import Pagination, { mobileItemsPerPage } from "../components/Pagination";
import SwapList, {
    type Swap,
    getSwapListHeight,
    sortSwaps,
} from "../components/SwapList";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { type tFn, useGlobalContext } from "../context/Global";
import { downloadJson, getExportFileName } from "../utils/download";
import { isMobile } from "../utils/helper";
import { latestStorageVersion } from "../utils/migration";
import { RescueAction, createRescueList } from "../utils/rescue";
import type { SomeSwap } from "../utils/swapCreator";

const historyItemsPerPage = 10;

export const historyListAction = ({ t, swap }: { t: tFn; swap: Swap }) => {
    switch (swap.action) {
        case RescueAction.Pending:
            return t("in_progress");
        case RescueAction.Claim:
            return t("claim");
        case RescueAction.Refund:
            return t("refund");
        case RescueAction.Failed:
            return t("failed");
        case RescueAction.Successful:
        default:
            return t("completed");
    }
};

const History = () => {
    const navigate = useNavigate();

    const { getSwaps, getRdnsAll, clearSwaps, t } = useGlobalContext();

    const [swaps, setSwaps] = createSignal<SomeSwap[]>([]);
    const [currentPage, setCurrentPage] = createSignal(1);
    const [currentSwaps, setCurrentSwaps] = createSignal<SomeSwap[]>([]);
    const [historyList] = createResource(
        currentSwaps,
        async (pageSwaps) => await createRescueList(pageSwaps, true),
    );

    const deleteLocalStorage = async () => {
        if (confirm(t("delete_storage"))) {
            await clearSwaps();
            setSwaps(await getSwaps());
        }
    };

    const exportLocalStorage = async () => {
        downloadJson(getExportFileName(), {
            version: latestStorageVersion,
            swaps: await getSwaps(),
            rdns: await getRdnsAll(),
        });
    };

    onMount(async () => {
        setSwaps(await getSwaps());
    });

    return (
        <div id="history">
            <div class="frame">
                <SettingsCog />
                <h2 class="frame-title">{t("refund_past_swaps")}</h2>
                <p>{t("refund_past_swaps_subline")}</p>
                <Show
                    when={swaps().length > 0}
                    fallback={
                        <div>
                            <p>{t("history_no_swaps")}</p>
                            <button
                                class="btn"
                                onClick={() => navigate("/swap")}>
                                {t("new_swap")}
                            </button>
                        </div>
                    }>
                    <Show
                        when={
                            !historyList.loading && historyList() !== undefined
                        }
                        fallback={
                            <div
                                class="center"
                                style={getSwapListHeight(
                                    swaps(),
                                    isMobile(),
                                    historyItemsPerPage,
                                )}>
                                <LoadingSpinner />
                            </div>
                        }>
                        <div
                            style={getSwapListHeight(
                                swaps(),
                                isMobile(),
                                historyItemsPerPage,
                            )}>
                            <SwapList
                                swapsSignal={() => historyList() ?? []}
                                /* eslint-disable-next-line solid/reactivity */
                                onDelete={async () => {
                                    setSwaps(await getSwaps());
                                }}
                                action={(swap) =>
                                    historyListAction({ t, swap })
                                }
                                onClick={(swap) => {
                                    navigate(`/swap/${swap.id}`, {
                                        state: {
                                            timedOutRefundable: swap.timedOut,
                                            waitForSwapTimeout:
                                                swap.waitForSwapTimeout,
                                        },
                                    });
                                }}
                                hideDateLabel
                                disableNoAction={false}
                            />
                        </div>
                    </Show>
                    <Pagination
                        items={swaps}
                        setDisplayedItems={(swaps) => setCurrentSwaps(swaps)}
                        sort={sortSwaps}
                        totalItems={swaps().length}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        itemsPerPage={
                            isMobile()
                                ? mobileItemsPerPage
                                : historyItemsPerPage
                        }
                    />
                    <button
                        class="btn btn-success"
                        onClick={exportLocalStorage}>
                        {t("history_export")}
                    </button>
                    <button class="btn btn-danger" onClick={deleteLocalStorage}>
                        {t("refund_clear")}
                    </button>
                </Show>
                <SettingsMenu />
            </div>
        </div>
    );
};

export default History;
