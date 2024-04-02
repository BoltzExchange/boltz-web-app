import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import { For, createEffect } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";

const RefundStep = () => {
    const params = useParams();
    const navigate = useNavigate();
    const { setSwap } = usePayContext();
    const { getSwap, t } = useGlobalContext();

    createEffect(async () => {
        const currentSwap = await getSwap(params.id);
        if (currentSwap) {
            log.debug("selecting swap", currentSwap);
            setSwap(currentSwap);
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
