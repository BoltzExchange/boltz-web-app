import { useI18n } from "@solid-primitives/i18n";
import { swap } from "../signals";

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
    hiddenElement.href =
        "data:application/json;charset=utf-8," +
        encodeURI(JSON.stringify(createRefundData(swap)));
    hiddenElement.target = "_blank";
    hiddenElement.download = "boltz-refund-" + swap.id + ".png";
    hiddenElement.click();
};


const DownloadRefund = () => {
    const [t] = useI18n();

    return (
        <div className="download-refund">
            <span
                class="btn btn-success"
                onclick={() => downloadRefundFile(swap())}>
                {t("download_refund_json")}
            </span>
        </div>
    );
};

export default DownloadRefund;
