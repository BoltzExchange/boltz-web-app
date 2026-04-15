import { useNavigate } from "@solidjs/router";
import { Show, createSignal, onMount } from "solid-js";

import Pagination, {
    desktopItemsPerPage,
    mobileItemsPerPage,
} from "../components/Pagination";
import SwapList, { getSwapListHeight, sortSwaps } from "../components/SwapList";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { useGlobalContext } from "../context/Global";
import { downloadJson, getExportFileName } from "../utils/download";
import { isMobile } from "../utils/helper";
import { latestStorageVersion } from "../utils/migration";
import type { SomeSwap } from "../utils/swapCreator";

const History = () => {
    const navigate = useNavigate();

    const { getSwaps, getRdnsAll, clearSwaps, t } = useGlobalContext();

    const [swaps, setSwaps] = createSignal<SomeSwap[]>([]);
    const [currentPage, setCurrentPage] = createSignal(1);
    const [currentSwaps, setCurrentSwaps] = createSignal<SomeSwap[]>([]);

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
                <h2>{t("refund_past_swaps")}</h2>
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
                    <div style={getSwapListHeight(swaps(), isMobile())}>
                        <SwapList
                            swapsSignal={currentSwaps}
                            /* eslint-disable-next-line solid/reactivity */
                            onDelete={async () => {
                                setSwaps(await getSwaps());
                            }}
                            action={() => t("view")}
                            hideStatusOnMobile
                        />
                    </div>
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
                                : desktopItemsPerPage
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
