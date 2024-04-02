import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createSignal, onMount } from "solid-js";

import SwapList from "../components/SwapList";
import { useGlobalContext } from "../context/Global";
import { downloadJson } from "../utils/download";
import { isIos } from "../utils/helper";

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

const History = () => {
    const navigate = useNavigate();

    let importRef: HTMLInputElement;

    const {
        getSwaps,
        clearSwaps,
        setSwapStorage,
        setNotification,
        setNotificationType,
        t,
    } = useGlobalContext();

    const [swaps, setSwaps] = createSignal<any[]>([]);

    const deleteLocalStorage = async () => {
        if (confirm(t("delete_storage"))) {
            await clearSwaps();
            setSwaps(await getSwaps());
        }
    };

    const backupLocalStorage = async () => {
        downloadJson(
            `boltz-backup-${Math.floor(Date.now() / 1000)}`,
            await getSwaps(),
        );
    };

    const importLocalStorage = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        new Response(inputFile)
            .json()
            .then(async (result) => {
                validateBackupFile(result);
                await clearSwaps();
                for (const swap of result) {
                    await setSwapStorage(swap);
                }
                setSwaps(result);
            })
            .catch((e) => {
                log.error("invalid file upload", e);
                setNotificationType("error");
                setNotification(t("invalid_backup_file"));
            });
    };

    onMount(async () => {
        setSwaps(await getSwaps());
    });

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
                        onDelete={async () => {
                            setSwaps(await getSwaps());
                        }}
                    />
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

export default History;
export { validateBackupFile };
