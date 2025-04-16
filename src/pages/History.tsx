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
import { Errors, validateRescueFile } from "../utils/rescueFile";
import type { SomeSwap } from "../utils/swapCreator";

type BackupFileType = { version: number; mnemonic: string; swaps: SomeSwap[] };

// Throws when the file is invalid
// Returns the version of the backup file
const validateBackupFile = (file: BackupFileType): BackupFileType => {
    const allSwapsHaveId = (swaps: { id: string }[]) => {
        if (swaps.some((swap) => swap.id === undefined || swap.id === null)) {
            throw Errors.NotAllElementsHaveAnId;
        }
    };

    if (typeof file !== "object") {
        throw Errors.InvalidFile;
    }

    if (!["version", "swaps", "mnemonic"].every((key) => key in file)) {
        throw Errors.InvalidFile;
    }

    validateRescueFile(file);

    allSwapsHaveId((file as BackupFileType).swaps);

    return file as BackupFileType;
};

const History = () => {
    const navigate = useNavigate();

    let importRef: HTMLInputElement;

    const {
        rescueFile,
        setRescueFile,
        setRescueFileBackupDone,
        getSwaps,
        clearSwaps,
        setSwapStorage,
        setNotification,
        setNotificationType,
        t,
    } = useGlobalContext();

    const [swaps, setSwaps] = createSignal<SomeSwap[]>([]);

    const deleteLocalStorage = async () => {
        if (confirm(t("delete_storage"))) {
            await clearSwaps();
            setSwaps(await getSwaps());
        }
    };

    const backupLocalStorage = async () => {
        downloadJson(getBackupFileName(), {
            version: latestStorageVersion,
            mnemonic: rescueFile().mnemonic,
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
                setRescueFile({ mnemonic: parsedFile.mnemonic });
                setRescueFileBackupDone(true);
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
                                    style={{ display: "none" }}
                                    accept="application/json"
                                    onChange={(e) => importLocalStorage(e)}
                                />
                            </button>
                        </div>
                    }>
                    <SwapList
                        swapsSignal={swaps}
                        /* eslint-disable-next-line solid/reactivity */
                        onDelete={async () => {
                            setSwaps(await getSwaps());
                        }}
                        action={() => t("view")}
                        hideStatusOnMobile
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
