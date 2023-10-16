import t from "../i18n";
import { swap } from "../signals";
import { isIos, isMobile, qr } from "../helper";
import { download, downloadJson } from "../utils/download";

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
    return `boltz-refund-${swap.id}`;
};

const downloadRefundJson = (swap) => {
    downloadJson(getRefundFileName(swap), createRefundData(swap));
};

const DownloadRefund = () => {
    const downloadRefundQr = (swap) => {
        qr(JSON.stringify(createRefundData(swap)), (url) => {
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
                download(`${getRefundFileName(swap)}.png`, url);
            }
        });
    };

    return (
        <div className="download-refund">
            <button
                class="btn btn-success"
                onclick={() =>
                    isMobile
                        ? downloadRefundQr(swap())
                        : downloadRefundJson(swap())
                }>
                {t("download_refund_file")}
            </button>
        </div>
    );
};

export default DownloadRefund;
