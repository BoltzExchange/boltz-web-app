import { For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import t from "../i18n";

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
        <div id="past-swaps">
            <For
                each={swapsSignal().sort((a, b) =>
                    a.date > b.date ? -1 : a.date === b.date ? 0 : 1,
                )}>
                {(swap) => (
                    <div class="past-swap">
                        <span
                            class="btn-small"
                            onClick={() => navigate("/swap/" + swap.id)}>
                            {t("view")}
                        </span>
                        <span
                            data-reverse={swap.reverse}
                            data-asset={swap.asset}
                            class="past-asset">
                            -&gt;
                        </span>
                        &nbsp;{t("id")}: {swap.id}, {t("created")}:{" "}
                        {formatDate(swap.date)}&nbsp;
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
