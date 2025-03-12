import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { rescueFileTypes } from "../utils/download";
import { validateRescueFile } from "../utils/rescueFile";
import type { RescueFile } from "../utils/rescueFile";
import { backupDone } from "./Backup";

export const existingBackupFileType = "existing";

const BackupVerify = () => {
    const navigate = useNavigate();
    const params = useParams<{ type?: string }>();

    const {
        t,
        rescueFile,
        rescueFileBackupDone,
        notify,
        newKey,
        deriveKey,
        ref,
        pairs,
        setPairs,
        setSwapStorage,
        setRescueFileBackupDone,
        clearSwaps,
        setRescueFile,
    } = useGlobalContext();
    const {
        swapType,
        assetSend,
        assetReceive,
        sendAmount,
        receiveAmount,
        invoice,
        onchainAddress,
        setOnchainAddress,
        setInvoice,
        setInvoiceValid,
        setAddressValid,
        valid,
    } = useCreateContext();
    const { signer, providers, getEtherSwap, hasBrowserWallet } =
        useWeb3Signer();

    const [verificationFailed, setVerificationFailed] = createSignal<
        boolean | undefined
    >(false);

    const [inputProcessing, setInputProcessing] = createSignal(false);

    const uploadChange = async (e: Event) => {
        try {
            setInputProcessing(true);

            const input = e.currentTarget as HTMLInputElement;
            const inputFile = input.files[0];

            let data: RescueFile;

            if (
                ["image/png", "image/jpg", "image/jpeg"].includes(
                    inputFile.type,
                )
            ) {
                data = JSON.parse(
                    (
                        await QrScanner.scanImage(inputFile, {
                            returnDetailedScanResult: true,
                        })
                    ).data,
                );
            } else {
                data = JSON.parse(await inputFile.text());
            }

            validateRescueFile(data);

            if (params.type === existingBackupFileType) {
                setRescueFileBackupDone(true);
                await clearSwaps();
                setRescueFile(data);
                log.info("Imported existing rescue file");
            } else {
                if (rescueFile()?.mnemonic !== data.mnemonic) {
                    throw "rescue file does not match";
                }

                setRescueFileBackupDone(true);
                log.info("Verified rescue file");
            }

            try {
                await backupDone(
                    navigate,
                    t,
                    notify,
                    newKey,
                    deriveKey,
                    valid,
                    ref,
                    rescueFileBackupDone,
                    pairs,
                    swapType,
                    assetSend,
                    assetReceive,
                    sendAmount,
                    receiveAmount,
                    invoice,
                    onchainAddress,
                    signer,
                    providers,
                    getEtherSwap,
                    hasBrowserWallet,
                    setPairs,
                    setInvoice,
                    setInvoiceValid,
                    setOnchainAddress,
                    setAddressValid,
                    setSwapStorage,
                );
            } catch (e) {
                log.error("Error creating swap", e);
                notify("error", e);
            }
        } catch (e) {
            log.error("invalid rescue file upload", e);
            setVerificationFailed(true);
        } finally {
            setInputProcessing(false);
        }
    };

    return (
        <div class="frame">
            <Show
                when={!verificationFailed()}
                fallback={
                    <>
                        <h2>{t("error")}</h2>
                        <h4>{t("verify_key_failed")}</h4>
                        <button
                            class="btn"
                            onClick={() => {
                                navigate("/backup");
                            }}>
                            {t("download_new_key")}
                        </button>
                    </>
                }>
                <h2>{t("verify_boltz_rescue_key")}</h2>
                <h4>{t("verify_boltz_rescue_key_subline")}</h4>
                <input
                    required
                    type="file"
                    id="rescueFileUpload"
                    data-testid="rescueFileUpload"
                    accept={rescueFileTypes}
                    disabled={inputProcessing()}
                    onChange={(e) => uploadChange(e)}
                />
                <Show when={inputProcessing()}>
                    <LoadingSpinner />
                </Show>
            </Show>
        </div>
    );
};

export default BackupVerify;
