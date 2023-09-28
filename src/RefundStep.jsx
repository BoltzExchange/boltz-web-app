import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import { createEffect } from "solid-js";

import DownloadRefund from "./components/DownloadRefund";
import t from "./i18n";
import { setSwap, swaps } from "./signals";

const RefundStep = () => {
    const params = useParams();
    const navigate = useNavigate();

    createEffect(() => {
        let tmp_swaps = swaps();
        if (tmp_swaps) {
            let current_swap = tmp_swaps
                .filter((s) => s.id === params.id)
                .pop();
            if (current_swap) {
                log.debug("selecting swap", current_swap);
                setSwap(current_swap);
            }
        }
    });

    return (
        <div id="refund-step">
            <div class="frame">
                <h2>{t("backup_refund")}</h2>
                <p>{t("backup_refund_subline")}</p>
                <ul class="bulletpoints">
                    <For each={t("backup_refund_list").split("\n")}>
                        {(line) => <li>{line}</li>}
                    </For>
                </ul>
                <hr />
                <p style="font-size: 46px; margin:0;">⚠️</p>
                <p>{t("backup_refund_skip")}</p>
                <hr />
                <div class="btns btns-space-between">
                    <button
                        class="btn btn-light"
                        onClick={() => navigate("/swap/" + params.id)}>
                        {t("backup_skip")}
                    </button>
                    <div onClick={() => navigate("/swap/" + params.id)}>
                        <DownloadRefund />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundStep;
