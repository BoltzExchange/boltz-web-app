import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import "../style/qrscan.scss";

const QrScan = () => {
    let qrRef: HTMLVideoElement;
    let qrScanner: QrScanner;

    const { pair, setInvoice, setOnchainAddress } = useCreateContext();
    const { t, notify } = useGlobalContext();

    const [camera, setCamera] = createSignal<boolean>(false);
    const [scanning, setScanning] = createSignal(false);

    onMount(async () => {
        const hasCamera = await QrScanner.hasCamera();
        log.debug("Has camera to scan QR codes:", hasCamera);
        setCamera(hasCamera);
    });

    const startScan = () => {
        if (qrScanner === undefined) {
            qrScanner = new QrScanner(
                qrRef,
                (result) => {
                    log.debug("scanned qr code:", result.data);
                    if (pair().swapToCreate?.type === SwapType.Submarine) {
                        setInvoice("");
                        setInvoice(result.data);
                    } else {
                        setOnchainAddress("");
                        setOnchainAddress(result.data);
                    }
                    stopScan();
                },
                {
                    maxScansPerSecond: 1000,
                    highlightScanRegion: true,
                    onDecodeError: () => {},
                },
            );
        }
        qrScanner
            .start()
            .then(() => {
                log.debug("qr scanner started");
                setScanning(true);
            })
            .catch((err) => {
                log.error("error starting qr scanner: ", err);
                notify("error", t("error_starting_qr_scanner"));
            });
    };

    const stopScan = () => {
        if (scanning()) {
            log.debug("stopping qr scanner");
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
                <div
                    id="video-wrapper"
                    style={scanning() ? "display: block" : "display: none"}>
                    <video id="qr-scanner" ref={qrRef} />
                    <span class="close-qr" onClick={stopScan}>
                        X
                    </span>
                </div>
                <hr />
            </Show>
        </>
    );
};

export default QrScan;
