import { useNavigate, useParams } from "@solidjs/router";
import QRCode from "qrcode/lib/server";
import { Accessor, createEffect } from "solid-js";

import Warning from "../components/Warning";
import { useGlobalContext } from "../context/Global";
import { DictKey } from "../i18n/i18n";
import { download, downloadJson } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";
import { RescueFile } from "../utils/rescueFile";

const rescueFileName = "boltz-rescue-key-DO-NOT-SHARE";

export const downloadRescueFile = async (
    t: (key: DictKey, values?: Record<string, unknown>) => string,
    rescueFile: Accessor<RescueFile>,
) => {
    if (!isMobile()) {
        downloadJson(rescueFileName, rescueFile());
    } else {
        const qrData = await QRCode.toDataURL(JSON.stringify(rescueFile()), {
            width: 1_500,
            errorCorrectionLevel: "L",
        });

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
};

const Backup = () => {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const { t, rescueFile, rescueFileBackupDone } = useGlobalContext();

    createEffect(() => {
        if (rescueFileBackupDone()) {
            navigate("/swap/" + params.id);
        }
    });

    const navigateToVerification = (id?: string) => {
        const basePath = "/backup/verify";
        navigate(id !== undefined ? `${basePath}/${id}` : basePath);
    };

    return (
        <div class="frame">
            <h2>{t("download_boltz_rescue_key")}</h2>
            <h4>{t("download_boltz_rescue_key_subline")}</h4>
            <p>{t("download_boltz_rescue_key_subline_second")}</p>
            <Warning />
            <p>{t("download_boltz_rescue_key_subline_third")}</p>
            <div class="btns">
                <button
                    class="btn btn-light"
                    onClick={() => {
                        navigateToVerification();
                    }}>
                    {t("verify_key")}
                </button>
                <button
                    class="btn"
                    onClick={async () => {
                        await downloadRescueFile(t, rescueFile);
                        navigateToVerification(params.id);
                    }}>
                    {t("download_new_key")}
                </button>
            </div>
        </div>
    );
};

export default Backup;
