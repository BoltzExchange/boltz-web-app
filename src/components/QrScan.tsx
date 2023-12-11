import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { isMobile } from "../helper";
import t from "../i18n";
import {
    camera,
    reverse,
    setCamera,
    setInvoice,
    setOnchainAddress,
} from "../signals";
import "../style/qrscan.scss";

const QrScan = () => {
    let qrRef: HTMLVideoElement;
    let qrScanner: QrScanner;

    const [scanning, setScanning] = createSignal(false);

    onMount(async () => {
        const hasCamera = await QrScanner.hasCamera();
        log.debug("detecting camera: ", hasCamera);
        if (!hasCamera) {
            return;
        }
        setCamera(hasCamera && isMobile);
    });

    const startScan = () => {
        setScanning(true);
        if (qrScanner === undefined) {
            qrScanner = new QrScanner(
                qrRef,
                (result) => {
                    log.debug("scanned qr code:", result.data);
                    if (reverse()) {
                        setOnchainAddress(result.data);
                    } else {
                        setInvoice(result.data);
                    }
                    stopScan();
                },
                {},
            );
        }
        qrScanner.start();
    };

    const stopScan = () => {
        if (scanning()) {
            qrScanner.destroy();
            setScanning(false);
            qrScanner = undefined;
        }
    };

    onCleanup(() => {
        stopScan();
    });

    return (
        <>
            <Show when={camera()}>
                <Show when={!scanning()}>
                    <button class="btn btn-light" onClick={startScan}>
                        {t("scan_qr_code")}
                    </button>
                </Show>
                <Show when={scanning()}>
                    <video
                        id="qr-scanner"
                        ref={qrRef}
                        onClick={stopScan}></video>
                </Show>
                <hr />
            </Show>
        </>
    );
};

export default QrScan;
