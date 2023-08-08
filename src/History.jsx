import log from "loglevel";
import { Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { isIos } from "./helper";
import SwapList from "./components/SwapList";
import { downloadJson } from "./utils/download";
import {
    swaps,
    setSwaps,
    setNotificationType,
    setNotification,
} from "./signals";
import "./style/history.scss";

// Throws when the file is invalid
const validateBackupFile = (file) => {
    // Check if the object is an array and all elements have at least the id property
    if (!(file instanceof Array)) {
        throw "not an Array";
    }

    if (file.some((swap) => swap.id === undefined || swap.id === null)) {
        throw "not all elements have an id";
    }
};

const History = () => {
    const [t] = useI18n();
    const navigate = useNavigate();

    let importRef;

    const deleteLocalStorage = () => {
        if (confirm(t("delete_localstorage"))) {
            setSwaps([]);
        }
    };

    const backupLocalStorage = () => {
        downloadJson(`boltz-backup-${Math.floor(Date.now() / 1000)}`, swaps());
    };

    const importLocalStorage = (e) => {
        const input = e.currentTarget;
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
                    <SwapList
                        swapsSignal={swaps}
                        setSwapSignal={setSwaps}
                        deleteButton={true}
                    />
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

export default History;
export { validateBackupFile };
