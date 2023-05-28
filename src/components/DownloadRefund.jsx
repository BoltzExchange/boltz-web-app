import log from "loglevel";
import QRCode from "qrcode";
import { useI18n } from "@solid-primitives/i18n";
import { swap, setNotificationType, setNotification } from "../signals";

const is_mobile =
    !!navigator.userAgent.match(/iphone|android|blackberry/gi) || false;

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

export const downloadRefundFile = (swap) => {
    const hiddenElement = document.createElement("a");
    hiddenElement.href =
        "data:application/json;charset=utf-8," +
        encodeURI(JSON.stringify(createRefundData(swap)));
    hiddenElement.target = "_blank";
    hiddenElement.download = getRefundFileName(swap) + ".json";
    hiddenElement.click();
};

export const downloadRefundQr = (swap) => {
    let hiddenElement = document.createElement("a");
    QRCode.toDataURL(JSON.stringify(createRefundData(swap)), {
        width: 400,
    })
        .then((url) => {
            hiddenElement.href = url;
            hiddenElement.target = "_blank";
            hiddenElement.download = getRefundFileName(swap) + ".png";
            hiddenElement.click();
        })
        .catch((err) => {
            const msg = "error: QR code generation failed";
            log.error(msg, err);
            setNotificationType("error");
            setNotification(msg);
        });
};

const DownloadRefund = () => {
    const [t] = useI18n();
    return (
        <div className="download-refund">
            <button
                class="btn btn-success"
                onclick={() =>
                    is_mobile
                        ? downloadRefundQr(swap())
                        : downloadRefundFile(swap())
                }>
                {t("download_refund_file")}
            </button>
        </div>
    );
};

export default DownloadRefund;
