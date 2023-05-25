import { Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { downloadBackup } from "./helper";
import { swaps, setSwaps } from "./signals";
import "./css/history.css";

const History = () => {
    const navigate = useNavigate();
    const [t] = useI18n();

    const printDate = (d) => {
        let date = new Date();
        date.setTime(d);
        return date.toLocaleDateString();
    };

    const deleteLocalstorage = () => {
        if (confirm(t("delete_localstorage"))) {
            setSwaps("[]");
        }
    };

    const delete_swap = (swap_id) => {
        if (confirm(t("delete_localstorage"))) {
            const tmp_swaps = JSON.parse(swaps());
            if (tmp_swaps) {
                const new_swaps = tmp_swaps.filter((s) => s.id !== swap_id);
                setSwaps(JSON.stringify(new_swaps));
            }
        }
    };

    return (
        <div id="history">
            <div class="frame">
                <h2>{t("refund_past_swaps")}</h2>
                <p>{t("refund_past_swaps_subline")}</p>
                <hr />
                <Show
                    when={JSON.parse(swaps()).length > 0}
                    fallback={
                        <div>
                            <p>{t("history_no_swaps")}</p>
                            <span class="btn" onClick={() => navigate("/swap")}>
                                {t("new_swap")}
                            </span>
                        </div>
                    }>
                    <div id="past-swaps">
                        <For each={JSON.parse(swaps())}>
                            {(swap) => (
                                <div class="past-swap">
                                    <span
                                        class="btn-small"
                                        onClick={() =>
                                            navigate("/swap/" + swap.id)
                                        }>
                                        view
                                    </span>
                                    <span
                                        data-reverse={swap.reverse}
                                        data-asset={swap.asset}
                                        class="past-asset">
                                        -&gt;
                                    </span>
                                    &nbsp;ID: {swap.id}, created:{" "}
                                    {printDate(swap.date)}&nbsp;
                                    <span
                                        class="btn-small btn-danger"
                                        onClick={() => delete_swap(swap.id)}>
                                        delete
                                    </span>
                                    <hr />
                                </div>
                            )}
                        </For>
                    </div>
                    <div class="btns">
                        <button
                            class="btn btn-danger"
                            onClick={deleteLocalstorage}>
                            {t("refund_clear")}
                        </button>
                        <button
                            class="btn "
                            onClick={() => downloadBackup(swaps())}>
                            {t("refund_backup")}
                        </button>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default History;
