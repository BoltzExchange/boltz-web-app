import { useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";

import t from "../i18n";
import "../style/swaplist.scss";

const SwapList = ({ swapsSignal, setSwapSignal, deleteButton }) => {
    const navigate = useNavigate();

    const formatDate = (d) => {
        let date = new Date();
        date.setTime(d);
        return date.toLocaleDateString();
    };

    const deleteSwap = (swapId) => {
        if (
            setSwapSignal !== undefined &&
            confirm(t("delete_localstorage_single_swap", { id: swapId }))
        ) {
            setSwapSignal(swapsSignal().filter((s) => s.id !== swapId));
        }
    };

    return (
        <div id="swaplist">
            <For
                each={swapsSignal().sort((a, b) =>
                    a.date > b.date ? -1 : a.date === b.date ? 0 : 1,
                )}>
                {(swap) => (
                    <div class="swaplist-item">
                        <span
                            class="btn-small"
                            onClick={() => navigate("/swap/" + swap.id)}>
                            {t("view")}
                        </span>
                        <span
                            data-reverse={swap.reverse}
                            data-asset={swap.asset}
                            class="swaplist-asset">
                            -&gt;
                        </span>
                        <span class="swaplist-asset-id">
                            {t("id")}:&nbsp;{swap.id}
                        </span>
                        <span class="swaplist-asset-date">
                            {t("created")}:&nbsp;{formatDate(swap.date)}
                        </span>
                        <Show when={deleteButton}>
                            <span
                                class="btn-small btn-danger"
                                onClick={() => deleteSwap(swap.id)}>
                                {t("delete")}
                            </span>
                        </Show>
                        <hr />
                    </div>
                )}
            </For>
        </div>
    );
};

export default SwapList;
