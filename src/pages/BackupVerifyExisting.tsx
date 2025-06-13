import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Match, Show, Switch, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import MnemonicInput, { rescueKeyMode } from "../components/MnemonicInput";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { getRescuableSwaps } from "../utils/boltzClient";
import { rescueFileTypes } from "../utils/download";
import { getXpub, validateRescueFile } from "../utils/rescueFile";
import type { RescueFile } from "../utils/rescueFile";
import { backupDone } from "./Backup";

export const existingBackupFileType = "existing";

const BackupVerify = () => {
    const navigate = useNavigate();
    const params = useParams<{ type?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

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
        setLastUsedKey,
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
    } = useCreateContext();
    const { signer, providers, getEtherSwap, hasBrowserWallet } =
        useWeb3Signer();

    const [verificationFailed, setVerificationFailed] = createSignal<
        boolean | undefined
    >(false);

    const [inputProcessing, setInputProcessing] = createSignal(false);

    const handleBackupDone = async () => {
        try {
            await backupDone(
                navigate,
                t,
                notify,
                newKey,
                deriveKey,
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
    };

    const validateBackup = async (data: RescueFile) => {
        validateRescueFile(data);

        if (params.type === existingBackupFileType) {
            const existingSwaps = await getRescuableSwaps(getXpub(data));
            const highestIndex = existingSwaps.reduce(
                (max, swap) => Math.max(max, swap.keyIndex),
                -1,
            );
            log.debug(`Found highest index: ${highestIndex}`);
            setLastUsedKey(highestIndex + 1);

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
    };

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
            await validateBackup(data);
            await handleBackupDone();
        } catch (e) {
            log.error("invalid rescue file upload", e);
            setVerificationFailed(true);
        } finally {
            setInputProcessing(false);
        }
    };

    const submitMnemonic = async (mnemonic: string) => {
        try {
            await validateBackup({ mnemonic });
            await handleBackupDone();
        } catch {
            setVerificationFailed(true);
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
                <Show when={searchParams.mode !== rescueKeyMode}>
                    <p style={{ margin: "1.2rem 0 1.2rem 0" }}>
                        {t("verify_boltz_rescue_key_subline")}
                    </p>
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
                <Show when={searchParams.mode === rescueKeyMode}>
                    <p style={{ "margin-top": "1.2rem" }}>
                        {t("verify_boltz_rescue_key_mnemonic")}
                    </p>
                    <MnemonicInput
                        onSubmit={(mnemonic) => {
                            void submitMnemonic(mnemonic);
                        }}
                    />
                </Show>

                <Switch>
                    <Match when={searchParams.mode !== rescueKeyMode}>
                        <button
                            class="btn btn-light"
                            data-testid="enterMnemonicBtn"
                            onClick={() =>
                                setSearchParams({
                                    mode: rescueKeyMode,
                                })
                            }>
                            {t("enter_mnemonic")}
                        </button>
                    </Match>
                    <Match when={searchParams.mode === rescueKeyMode}>
                        <button
                            class="btn btn-light"
                            data-testid="backBtn"
                            onClick={() =>
                                setSearchParams({
                                    mode: null,
                                })
                            }>
                            {t("back")}
                        </button>
                    </Match>
                </Switch>
            </Show>
        </div>
    );
};

export default BackupVerify;
