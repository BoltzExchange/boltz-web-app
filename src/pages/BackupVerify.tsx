import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal } from "solid-js";

import { BackupDone } from "../components/CreateButton";
import LoadingSpinner from "../components/LoadingSpinner";
import { useGlobalContext } from "../context/Global";
import { getRescuableSwaps } from "../utils/boltzClient";
import { rescueFileTypes } from "../utils/download";
import { getXpub, validateRescueFile } from "../utils/rescueFile";
import type { RescueFile } from "../utils/rescueFile";

export const existingBackupFileType = "existing";

const VerifyExisting = () => {
    const navigate = useNavigate();
    const params = useParams<{ type?: string }>();

    const {
        t,
        rescueFile,
        setRescueFileBackupDone,
        clearSwaps,
        setRescueFile,
        setLastUsedKey,
    } = useGlobalContext();

    const [verificationFailed, setVerificationFailed] = createSignal<
        boolean | undefined
    >(false);

    const [inputProcessing, setInputProcessing] = createSignal(false);

    const validateBackup = async (data: RescueFile) => {
        validateRescueFile(data);

        if (params.type === existingBackupFileType) {
            const existingSwaps = await getRescuableSwaps(getXpub(data));
            const highestIndex = existingSwaps.reduce(
                (max, swap) => Math.max(max, swap.keyIndex),
                -1,
            );
            log.debug(`Found highest index: ${highestIndex}`);
            setLastUsedKey(highestIndex + 1);

            setRescueFileBackupDone(true);
            await clearSwaps();
            setRescueFile(data);
            log.info("Imported existing rescue file");
        } else {
            if (rescueFile()?.mnemonic !== data.mnemonic) {
                throw "rescue file does not match";
            }

            setRescueFileBackupDone(true);
            log.info("Verified rescue file");
        }
    };

    const uploadChange = async (e: Event) => {
        try {
            setInputProcessing(true);

            const input = e.currentTarget as HTMLInputElement;
            const inputFile = input.files[0];

            let data: RescueFile;

            if (
                ["image/png", "image/jpg", "image/jpeg"].includes(
                    inputFile.type,
                )
            ) {
                data = JSON.parse(
                    (
                        await QrScanner.scanImage(inputFile, {
                            returnDetailedScanResult: true,
                        })
                    ).data,
                );
            } else {
                data = JSON.parse(await inputFile.text());
            }
            await validateBackup(data);
            navigate("/swap", { state: { backupDone: BackupDone.True } });
        } catch (e) {
            log.error("invalid rescue file upload", e);
            setVerificationFailed(true);
        } finally {
            setInputProcessing(false);
        }
    };

    return (
        <div class="frame">
            <Show
                when={!verificationFailed()}
                fallback={
                    <>
                        <h2>{t("error")}</h2>
                        <h4>{t("verify_key_failed")}</h4>
                        <button
                            class="btn"
                            onClick={() => {
                                navigate("/backup");
                            }}>
                            {t("download_new_key")}
                        </button>
                    </>
                }>
                <h2>{t("verify_boltz_rescue_key")}</h2>
                <h4>{t("verify_boltz_rescue_key_subline")}</h4>
                <input
                    required
                    type="file"
                    id="rescueFileUpload"
                    data-testid="rescueFileUpload"
                    accept={rescueFileTypes}
                    disabled={inputProcessing()}
                    onChange={(e) => uploadChange(e)}
                />
                <Show when={inputProcessing()}>
                    <LoadingSpinner />
                </Show>
            </Show>
        </div>
    );
};

export default VerifyExisting;
