import log from "loglevel";
import QRCode from "qrcode/lib/server";

import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { download, downloadJson, getRefundFileName } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";

const downloadRefundJson = (swap: { id: string } & Record<string, unknown>) => {
    downloadJson(getRefundFileName(swap.id), swap);
};

const DownloadRefund = () => {
    const { swap } = usePayContext();
    const { t } = useGlobalContext();

    const downloadRefundQr = (
        swap: { id: string } & Record<string, unknown>,
    ) => {
        QRCode.toDataURL(JSON.stringify(swap), {
            width: 2500,
            errorCorrectionLevel: "L",
        })
            .then((url: string) => {
                if (isIos()) {
                    // Compatibility with third party iOS browsers
                    const newTab = window.open();
                    newTab.document.body.innerHTML = `
                        <!DOCTYPE html>
                        <body>
                            <h1>${t("ios_image_download_do_not_share")}</h1>
                            <h2>${t("ios_image_download")}</h2>
                            <img src="${url}">
                        </body>`;
                } else {
                    download(`${getRefundFileName(swap.id)}.png`, url);
                }
            })
            .catch((err: Error) => {
                log.error("qr code generation error", err);
            });
    };

    return (
        <button
            class="btn btn-success"
            onClick={() =>
                isMobile()
                    ? downloadRefundQr(swap())
                    : downloadRefundJson(swap())
            }>
            {t("download_refund_file")}
        </button>
    );
};

export default DownloadRefund;
