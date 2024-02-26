import log from "loglevel";

import { useAppContext } from "../context/App";
import { useGlobalContext } from "../context/Global";
import { download, downloadJson } from "../utils/download";
import { isIos, isMobile } from "../utils/helper";
import { boltzCore, createLazyModule } from "../utils/lazy";

const QRCode = createLazyModule(() => import("qrcode/lib/server"));

const createRefundData = (swap: any) => {
    return {
        id: swap.id,
        asset: swap.asset,
        version: swap.version,
        privateKey: swap.privateKey,
        blindingKey: swap.blindingKey,
        redeemScript: swap.redeemScript,
        claimPublicKey: swap.claimPublicKey,
        timeoutBlockHeight: swap.timeoutBlockHeight,
        swapTree: boltzCore.SwapTreeSerializer.serializeSwapTree(swap.swapTree),
    };
};

const getRefundFileName = (swap: any): string => {
    return `boltz-refund-${swap.id}`;
};

const downloadRefundJson = (swap: any) => {
    downloadJson(getRefundFileName(swap), createRefundData(swap));
};

const DownloadRefund = () => {
    const { swap } = useAppContext();
    const { t } = useGlobalContext();
    const downloadRefundQr = (swap: any) => {
        QRCode.toDataURL(JSON.stringify(createRefundData(swap)), { width: 400 })
            .then((url: string) => {
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
            })
            .catch((err: Error) => {
                log.error("qr code generation error", err);
            });
    };

    return (
        <button
            class="btn btn-success"
            onclick={() =>
                isMobile ? downloadRefundQr(swap()) : downloadRefundJson(swap())
            }>
            {t("download_refund_file")}
        </button>
    );
};

export default DownloadRefund;
