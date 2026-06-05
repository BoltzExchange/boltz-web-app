import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import "../style/qrscan.scss";
import {
    DestinationInputStatus,
    DestinationInputType,
    parseDestinationInput,
} from "../utils/destinationInput";

const QrScan = () => {
    let qrRef!: HTMLVideoElement;
    let qrScanner: QrScanner | undefined;

    const {
        pair,
        setPair,
        minerFee,
        setAddressValid,
        setOnchainAddress,
        setInvoice,
        setAmountChanged,
        setReceiveAmount,
        setSendAmount,
    } = useCreateContext();
    const { t, notify, pairs, regularPairs, bitcoinOnly } = useGlobalContext();

    const [camera, setCamera] = createSignal<boolean>(false);
    const [scanning, setScanning] = createSignal(false);

    onMount(async () => {
        const hasCamera = await QrScanner.hasCamera();
        log.debug("Has camera to scan QR codes:", hasCamera);
        setCamera(hasCamera);
    });

    const handleScan = async (data: string) => {
        const scannedValue = data.trim();
        log.debug("scanned qr code:", scannedValue);

        setOnchainAddress(scannedValue);
        setAddressValid(false);

        const result = await parseDestinationInput(
            scannedValue,
            pair(),
            pairs(),
            regularPairs(),
            minerFee(),
            bitcoinOnly(),
        );

        if (result.status === DestinationInputStatus.Invalid) {
            notify("error", t("invalid_address", { asset: pair().toAsset }));
        }

        if (result.status !== DestinationInputStatus.Valid) {
            return;
        }

        if (result.amount !== undefined) {
            setAmountChanged(Side.Receive);
            setReceiveAmount(result.amount.receiveAmount);
            setSendAmount(result.amount.sendAmount);
        }

        if (result.switched) {
            setPair(result.nextPair);
            notify("success", t("switch_paste"));
        }

        if (result.destination.type === DestinationInputType.Invoice) {
            setOnchainAddress("");
            setInvoice(result.destination.invoice);
        } else {
            setAddressValid(true);
            setOnchainAddress(result.destination.address);
        }
    };

    const startScan = () => {
        if (qrScanner === undefined) {
            qrScanner = new QrScanner(
                qrRef,
                (result) => {
                    void handleScan(result.data);
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
        if (scanning() && qrScanner !== undefined) {
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
