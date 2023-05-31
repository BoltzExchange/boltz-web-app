import { useI18n } from "@solid-primitives/i18n";
import { useNavigate } from "@solidjs/router";
import { setSwaps } from "../signals";

const SwapList = ({ swapsSignal, deleteButton }) => {
    const [t] = useI18n();
    const navigate = useNavigate();

    const printDate = (d) => {
        let date = new Date();
        date.setTime(d);
        return date.toLocaleDateString();
    };

    const delete_swap = (swap_id) => {
        if (confirm(t("delete_localstorage"))) {
            const tmp_swaps = JSON.parse(swapsSignal());
            if (tmp_swaps) {
                const new_swaps = tmp_swaps.filter((s) => s.id !== swap_id);
                setSwaps(JSON.stringify(new_swaps));
            }
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
                                onClick={() => delete_swap(swap.id)}>
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
