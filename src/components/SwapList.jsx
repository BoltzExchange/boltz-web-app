import { useI18n } from "@solid-primitives/i18n";
import { useNavigate } from "@solidjs/router";

const SwapList = ({ swapsSignal, setSwapSignal, deleteButton }) => {
    const [t] = useI18n();
    const navigate = useNavigate();

    const printDate = (d) => {
        let date = new Date();
        date.setTime(d);
        return date.toLocaleDateString();
    };

    const deleteSwap = (swapId) => {
        if (
            setSwapSignal !== undefined &&
            confirm(t("delete_localstorage_single_swap", { id: swapId }))
        ) {
            setSwapSignal(swapsSignal().filter((s) => s.id != swapId));
        }
    };

    return (
        <div id="past-swaps">
            <For each={swapsSignal()}>
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
                        {printDate(swap.date)}&nbsp;
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
