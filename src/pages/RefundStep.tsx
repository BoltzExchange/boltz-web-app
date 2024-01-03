import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import { For } from "solid-js";
import { createEffect } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import t from "../i18n";
import { setSwap, swaps } from "../signals";

const RefundStep = () => {
    const params = useParams();
    const navigate = useNavigate();

    createEffect(() => {
        let tmpSwaps = swaps();
        if (tmpSwaps) {
            let currentSwap = tmpSwaps.filter((s) => s.id === params.id).pop();
            if (currentSwap) {
                log.debug("selecting swap", currentSwap);
                setSwap(currentSwap);
            }
        }
    });

    return (
        <div id="refund-step">
            <div class="frame">
                <h2>{t("backup_refund")}</h2>
                <p>{t("backup_refund_subline")}</p>
                <ul class="bulletpoints">
                    <For
                        each={[
                            "backup_refund_list_incognito",
                            "backup_refund_list_tor",
                            "backup_refund_list_clear_history",
                        ]}>
                        {(path) => <li>{t(path)}</li>}
                    </For>
                </ul>
                <hr />
                <p style="font-size: 46px; margin:0;">⚠️</p>
                <h3>{t("backup_refund_skip")}</h3>
                <hr />
                <div class="btns btns-space-between">
                    <button
                        class="btn btn-light no-grow"
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
