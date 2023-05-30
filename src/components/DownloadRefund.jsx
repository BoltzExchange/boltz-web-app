import log from "loglevel";
import QRCode from "qrcode";
import { useI18n } from "@solid-primitives/i18n";
import { swap, setNotificationType, setNotification } from "../signals";

const isIos = !!navigator.userAgent.match(/iphone|ipad/gi) || false;
const isMobile =
    isIos || !!navigator.userAgent.match(/android|blackberry/gi) || false;

const createRefundData = (swap) => {
    return {
        id: swap.id,
        asset: swap.asset,
        privateKey: swap.privateKey,
        blindingKey: swap.blindingKey,
        redeemScript: swap.redeemScript,
        timeoutBlockHeight: swap.timeoutBlockHeight,
    };
};

const getRefundFileName = (swap) => {
    return "boltz-refund-" + swap.id;
};

const downloadRefundFile = (swap) => {
    const hiddenElement = document.createElement("a");
    hiddenElement.href =
        "data:application/json;charset=utf-8," +
        encodeURI(JSON.stringify(createRefundData(swap)));
    hiddenElement.target = "_blank";
    hiddenElement.download = getRefundFileName(swap) + ".json";
    hiddenElement.click();
};

const DownloadRefund = () => {
    const [t] = useI18n();

    const downloadRefundQr = (swap) => {
        QRCode.toDataURL(JSON.stringify(createRefundData(swap)), {
            width: 400,
        })
            .then(async (url) => {
                if (isIos) {
                    // Compatibility with third party iOS browsers
                    const newTab = window.open();
                    newTab.document.body.innerHTML = `
                    <!DOCTYPE html>
                    <body>
                        <img src="${url}">
                        <h1>${t("ios_image_download")}</h1>
                    </body>`;
                } else {
                    const hiddenElement = document.createElement("a");
                    hiddenElement.href = url;
                    hiddenElement.target = "_blank";
                    hiddenElement.download = getRefundFileName(swap) + ".png";
                    hiddenElement.click();
                }
            })
            .catch((err) => {
                const msg = "error: QR code generation failed";
                log.error(msg, err);
                setNotificationType("error");
                setNotification(msg);
            });
    };

    return (
        <div className="download-refund">
            <button
                class="btn btn-success"
                onclick={() =>
                    isMobile
                        ? downloadRefundQr(swap())
                        : downloadRefundFile(swap())
                }>
                {t("download_refund_file")}
            </button>
        </div>
    );
};

export default DownloadRefund;
