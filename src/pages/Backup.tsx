import { useNavigate, useParams } from "@solidjs/router";
import QRCode from "qrcode/lib/server";
import { createEffect } from "solid-js";

import Warning from "../components/Warning";
import { useGlobalContext } from "../context/Global";
import { download, downloadJson } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";
import { existingBackupId } from "./BackupVerify";

const rescueFileName = "boltz-rescue-key-DO-NOT-SHARE";

const Backup = () => {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const { t, rescueFile, rescueFileBackupDone } = useGlobalContext();

    createEffect(() => {
        if (rescueFileBackupDone()) {
            navigate("/swap/" + params.id);
        }
    });

    const navigateToVerification = (id: string) => {
        navigate("/backup/verify/" + id);
    };

    const downloadRescueFile = async () => {
        if (!isMobile()) {
            downloadJson(rescueFileName, rescueFile());
        } else {
            const qrData = await QRCode.toDataURL(
                JSON.stringify(rescueFile()),
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
                download(`${rescueFileName}.png`, qrData);
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
                <button class="btn" onClick={downloadRescueFile}>
                    {t("download_rescue_key")}
                </button>
            </div>
        </div>
    );
};

export default Backup;
