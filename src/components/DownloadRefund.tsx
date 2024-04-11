import log from "loglevel";
import QRCode from "qrcode/lib/server";

import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { download, downloadJson } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";

const getRefundFileName = (swap: any): string => {
    return `boltz-refund-${swap.id}`;
};

const downloadRefundJson = (swap: any) => {
    downloadJson(getRefundFileName(swap), swap);
};

const DownloadRefund = () => {
    const { swap } = usePayContext();
    const { t } = useGlobalContext();

    const downloadRefundQr = (swap: any) => {
        QRCode.toDataURL(JSON.stringify(swap), { width: 400 })
            .then((url: string) => {
                if (isIos()) {
                    // Compatibility with third party iOS browsers
                    const newTab = window.open();
                    newTab.document.body.innerHTML = `
                        <!DOCTYPE html>
                        <body>
                            <img src="${url}">
                            <h1>${t("ios_image_download")}</h1>
                        </body>`;
                } else {
                    download(`${getRefundFileName(swap)}.png`, url);
                }
            })
            .catch((err: Error) => {
                log.error("qr code generation error", err);
            });
    };

    return (
        <button
            class="btn btn-success"
            onclick={() =>
                isMobile()
                    ? downloadRefundQr(swap())
                    : downloadRefundJson(swap())
            }>
            {t("download_refund_file")}
        </button>
    );
};

export default DownloadRefund;
