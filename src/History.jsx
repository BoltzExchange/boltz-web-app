import { Show } from "solid-js";
import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { downloadBackup } from "./helper";
import { swaps, setSwaps } from "./signals";
import SwapList from "./components/SwapList";
import "./css/history.css";

const History = () => {
    const navigate = useNavigate();
    const [t] = useI18n();

    const deleteLocalstorage = () => {
        if (confirm(t("delete_localstorage"))) {
            setSwaps("[]");
        }
    };

    const [parsedSwaps, setParsedSwaps] = createSignal(JSON.parse(swaps()));

    return (
        <div id="history">
            <div class="frame">
                <h2>{t("refund_past_swaps")}</h2>
                <p>{t("refund_past_swaps_subline")}</p>
                <hr />
                <Show
                    when={parsedSwaps().length > 0}
                    fallback={
                        <div>
                            <p>{t("history_no_swaps")}</p>
                            <span class="btn" onClick={() => navigate("/swap")}>
                                {t("new_swap")}
                            </span>
                        </div>
                    }>
                    <SwapList swapsSignal={parsedSwaps} deleteButton={true} />
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
