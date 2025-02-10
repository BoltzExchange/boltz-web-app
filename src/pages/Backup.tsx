import { useNavigate, useParams } from "@solidjs/router";
import QRCode from "qrcode/lib/server";
import { createEffect } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { download, downloadJson } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";

const recoveryFileName = "boltz-recovery";

const Backup = () => {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const {
        t,
        recoveryFile,
        setRecoveryFileBackupDone,
        recoveryFileBackupDone,
    } = useGlobalContext();

    createEffect(() => {
        if (recoveryFileBackupDone()) {
            recoveryFileDownloaded();
        }
    });

    const recoveryFileDownloaded = () => {
        setRecoveryFileBackupDone(true);
        navigate("/swap/" + params.id);
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
                            <img src="${qrData}">
                        </body>`;
            } else {
                download(`${recoveryFileName}.png`, qrData);
            }
        }

        recoveryFileDownloaded();
    };

    return (
        <div class="frame">
            <h2>{t("backup_refund")}</h2>
            <p>{t("backup_subline")}</p>
            <button class="btn" onClick={downloadRecoveryFile}>
                {t("download_refund_file")}
            </button>
        </div>
    );
};

export default Backup;
