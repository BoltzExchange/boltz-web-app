import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { rescueFileTypes } from "../utils/download";
import { validateRescueFile } from "../utils/rescueFile";
import type { RescueFile } from "../utils/rescueFile";

const BackupVerify = () => {
    const navigate = useNavigate();
    const params = useParams<{ id?: string }>();
    const {
        t,
        rescueFile,
        setRescueFileBackupDone,
        clearSwaps,
        setRescueFile,
    } = useGlobalContext();

    const [verificationFailed, setVerificationFailed] = createSignal<
        boolean | undefined
    >(false);

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];

        try {
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

            validateRescueFile(data);

            if (params.id === undefined) {
                setRescueFileBackupDone(true);
                await clearSwaps();
                setRescueFile(data);
                log.info("Imported existing rescue file");
                navigate("/");
            } else {
                if (rescueFile()?.mnemonic !== data.mnemonic) {
                    throw "rescue file does not match";
                }

                setRescueFileBackupDone(true);
                log.info("Verified rescue file");
                navigate(`/swap/${params.id}`);
            }
        } catch (e) {
            log.error("invalid rescue file upload", e);
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
                        <h4>{t("verify_key_failed")}</h4>
                        <button
                            class="btn"
                            onClick={() => {
                                navigate("/backup/" + params.id);
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
                    onChange={(e) => uploadChange(e)}
                />
            </Show>
        </div>
    );
};

export default BackupVerify;
