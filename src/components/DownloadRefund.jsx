import { useI18n } from "@solid-primitives/i18n";
import { swap } from "../signals";
import QRCode from "qrcode";

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

export const downloadRefundFile = (swap) => {
    const hiddenElement = document.createElement("a");
    hiddenElement.href =
        "data:application/json;charset=utf-8," +
        encodeURI(JSON.stringify(createRefundData(swap)));
    hiddenElement.target = "_blank";
    hiddenElement.download = "boltz-refund-" + swap.id + ".json";
    hiddenElement.click();
};

export const downloadRefundQr = (swap) => {
    let hiddenElement = document.createElement("a");
    QRCode.toDataURL(JSON.stringify(createRefundData(swap)), {
        version: 14,
        width: 400,
    })
        .then((url) => {
            hiddenElement.href = url;
            hiddenElement.target = "_blank";
            hiddenElement.download = "boltz-refund-" + swap.id + ".png";
            hiddenElement.click();
        })
        .catch((err) => {
            const msg = "error: qr code generation";
            log.error(msg, err);
            setNotificationType("error");
            setNotification(msg);
        });
};

const DownloadRefund = () => {
    const [t] = useI18n();
    return (
        <div className="download-refund">
            <Show when={is_mobile}>
                <button
                    class="btn btn-success"
                    onclick={() => downloadRefundQr(swap())}>
                    {t("download_refund_qr")}
                </button>
            </Show>
            <Show when={!is_mobile}>
                <button
                    class="btn btn-success"
                    onclick={() => downloadRefundFile(swap())}>
                    {t("download_refund_json")}
                </button>
            </Show>
        </div>
    );
};

export default DownloadRefund;
