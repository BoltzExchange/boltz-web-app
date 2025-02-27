import { useNavigate, useParams } from "@solidjs/router";
import QRCode from "qrcode/lib/server";
import { createEffect } from "solid-js";

import Warning from "../components/Warning";
import { useGlobalContext } from "../context/Global";
import { download, downloadJson } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";
import { existingBackupId } from "./BackupVerify";

const recoveryFileName = "boltz-recovery-DO-NOT-SHARE";

const Backup = () => {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const { t, recoveryFile, recoveryFileBackupDone } = useGlobalContext();

    createEffect(() => {
        if (recoveryFileBackupDone()) {
            navigate("/swap/" + params.id);
        }
    });

    const navigateToVerification = (id: string) => {
        navigate("/backup/verify/" + id);
    };

    const downloadRecoveryFile = async () => {
        if (!isMobile()) {
            downloadJson(recoveryFileName, recoveryFile());
        } else {
            const qrData = await QRCode.toDataURL(
                JSON.stringify(recoveryFile()),
                {
                    width: 1_500,
                    errorCorrectionLevel: "L",
                },
            );

            if (isIos()) {
                const newTab = window.open();
                newTab.document.body.innerHTML = `
                        <!DOCTYPE html>
                        <body>
                            <h1>${t("ios_image_download_do_not_share")}</h1>
                            <h2>${t("ios_image_download")}</h2>
                            <img src="${qrData}">
                        </body>`;
            } else {
                download(`${recoveryFileName}.png`, qrData);
            }
        }

        navigateToVerification(params.id);
    };

    return (
        <div class="frame">
            <h2>{t("backup_rescue_key")}</h2>
            <h4>{t("backup_subline")}</h4>
            <Warning />
            <p>{t("backup_subline_second")}</p>
            <div class="btns">
                <button
                    class="btn btn-light"
                    onClick={() => {
                        navigateToVerification(existingBackupId);
                    }}>
                    {t("verify_existing_rescue_key")}
                </button>
                <button class="btn" onClick={downloadRecoveryFile}>
                    {t("download_rescue_key")}
                </button>
            </div>
        </div>
    );
};

export default Backup;
