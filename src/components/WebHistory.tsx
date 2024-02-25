import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show } from "solid-js";

import { useAppContext } from "../context/App";
import { useGlobalContext } from "../context/Global";
import { downloadJson } from "../utils/download";
import { isIos } from "../utils/helper";
import SwapList from "./SwapList";

// Throws when the file is invalid
const validateBackupFile = (file: any) => {
    // Check if the object is an array and all elements have at least the id property
    if (!(file instanceof Array)) {
        throw "not an Array";
    }

    if (file.some((swap) => swap.id === undefined || swap.id === null)) {
        throw "not all elements have an id";
    }
};

const WebHistory = () => {
    const navigate = useNavigate();

    let importRef: HTMLInputElement;

    const { setNotification, setNotificationType, t } = useGlobalContext();
    const { swaps, setSwaps } = useAppContext();

    const deleteLocalStorage = () => {
        if (confirm(t("delete_localstorage"))) {
            setSwaps([]);
        }
    };

    const backupLocalStorage = () => {
        downloadJson(`boltz-backup-${Math.floor(Date.now() / 1000)}`, swaps());
    };

    const importLocalStorage = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        new Response(inputFile)
            .json()
            .then((result) => {
                validateBackupFile(result);
                setSwaps(result);
            })
            .catch((e) => {
                log.error("invalid file upload", e);
                setNotificationType("error");
                setNotification(t("invalid_backup_file"));
            });
    };

    const deleteSwap = (swapId: string) => {
        if (confirm(t("delete_localstorage_single_swap", { id: swapId }))) {
            setSwaps(swaps().filter((s: any) => s.id !== swapId));
        }
    };

    return (
        <div id="history">
            <div class="frame">
                <h2>{t("refund_past_swaps")}</h2>
                <p>{t("refund_past_swaps_subline")}</p>
                <hr />
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
                            <button
                                onClick={() => importRef.click()}
                                class="btn btn-success">
                                {t("refund_import")}
                                <input
                                    ref={importRef}
                                    required
                                    type="file"
                                    style="display: none"
                                    accept="application/json"
                                    onChange={(e) => importLocalStorage(e)}
                                />
                            </button>
                        </div>
                    }>
                    <SwapList swapsSignal={swaps} deleteSwap={deleteSwap} />
                    <hr />
                    <Show when={swaps().length > 0}>
                        <Show when={!isIos}>
                            <button
                                class="btn btn-success"
                                onClick={backupLocalStorage}>
                                {t("refund_backup")}
                            </button>
                        </Show>
                        <button
                            class="btn btn-danger"
                            onClick={deleteLocalStorage}>
                            {t("refund_clear")}
                        </button>
                    </Show>
                </Show>
            </div>
        </div>
    );
};
export default WebHistory;
export { validateBackupFile };
