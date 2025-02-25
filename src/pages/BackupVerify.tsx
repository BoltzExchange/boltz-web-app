import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { recoveryFileTypes } from "../utils/download";
import { RecoveryFile } from "../utils/recoveryFile";
import { validateRecoveryFile } from "../utils/refundFile";

export const existingBackupId = "existing";

const BackupVerify = () => {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const {
        t,
        recoveryFile,
        setRecoveryFileBackupDone,
        clearSwaps,
        setRecoveryFile,
    } = useGlobalContext();

    const [verificationFailed, setVerificationFailed] = createSignal<
        boolean | undefined
    >(false);

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];

        try {
            let data: RecoveryFile;

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

            validateRecoveryFile(data);

            if (params.id === existingBackupId) {
                setRecoveryFileBackupDone(true);
                await clearSwaps();
                setRecoveryFile(data);
                log.info("Imported existing recovery file");
                navigate("/");
            } else {
                if (recoveryFile()?.xpriv !== data.xpriv) {
                    throw "recovery file does not match";
                }

                setRecoveryFileBackupDone(true);
                log.info("Verified recovery file");
                navigate(`/swap/${params.id}`);
            }
        } catch (e) {
            log.error("invalid recovery file upload", e);
            setVerificationFailed(true);
        }
    };

    return (
        <div class="frame">
            <Show
                when={!verificationFailed()}
                fallback={
                    <>
                        <h2>{t("error")}</h2>
                        <h4>{t("verify_rescue_file_failed")}</h4>
                        <button
                            class="btn"
                            onClick={() => {
                                navigate("/backup/" + params.id);
                            }}>
                            {t("download_rescue_key")}
                        </button>
                    </>
                }>
                <h2>{t("verify_existing_rescue_key")}</h2>
                <h4>{t("verify_existing_rescue_key_subline")}</h4>
                <input
                    required
                    type="file"
                    id="refundUpload"
                    data-testid="refundUpload"
                    accept={recoveryFileTypes}
                    onChange={(e) => uploadChange(e)}
                />
            </Show>
        </div>
    );
};

export default BackupVerify;
