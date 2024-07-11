import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show, createSignal, onMount } from "solid-js";

import SwapList from "../components/SwapList";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { useGlobalContext } from "../context/Global";
import { downloadJson, getBackupFileName } from "../utils/download";
import { isIos } from "../utils/helper";
import { latestStorageVersion, migrateBackupFile } from "../utils/migration";
import { SomeSwap } from "../utils/swapCreator";

export const invalidBackupFileError = "invalid file";

type BackupFileType = { version: number; swaps: SomeSwap[] };

// Throws when the file is invalid
// Returns the version of the backup file
const validateBackupFile = (file: BackupFileType | any[]): BackupFileType => {
    const allSwapsHaveId = (swaps: any[]) => {
        if (swaps.some((swap) => swap.id === undefined || swap.id === null)) {
            throw "not all elements have an id";
        }
    };

    if (file instanceof Array) {
        allSwapsHaveId(file);
        return { version: 0, swaps: file };
    } else if (typeof file === "object") {
        if (!["version", "swaps"].every((key) => key in file)) {
            throw invalidBackupFileError;
        }

        allSwapsHaveId(file.swaps);
        return file;
    } else {
        throw invalidBackupFileError;
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
        downloadJson(getBackupFileName(), {
            version: latestStorageVersion,
            swaps: await getSwaps(),
        });
    };

    const importLocalStorage = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        new Response(inputFile)
            .json()
            .then(async (result: BackupFileType) => {
                const parsedFile = validateBackupFile(result);
                log.debug(
                    `Found backup file of version: ${parsedFile.version}`,
                );
                await clearSwaps();

                const swaps = migrateBackupFile(
                    parsedFile.version,
                    parsedFile.swaps,
                );

                for (const swap of swaps) {
                    await setSwapStorage(swap);
                }
                setSwaps(swaps);
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
                <SettingsCog />
                <h2>{t("refund_past_swaps")}</h2>
                <p>{t("refund_past_swaps_subline")}</p>
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
                    <Show when={swaps().length > 0}>
                        <Show when={!isIos()}>
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
                <SettingsMenu />
            </div>
        </div>
    );
};

export default History;
export { validateBackupFile };
