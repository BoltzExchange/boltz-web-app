import { wordlist } from "@scure/bip39/wordlists/english";
import { useNavigate, useParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { For, Match, Show, Switch, createSignal } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
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
        valid,
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
            await handleBackupDone();
        } catch (e) {
            log.error("invalid rescue file upload", e);
            setVerificationFailed(true);
        } finally {
            setInputProcessing(false);
        }
    };

    const BackupVerifyFile = () => (
        <>
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
        </>
    );

    const BackupVerifyMnemonic = () => {
        const [displayedGroup, setDisplayedGroup] = createSignal<number>(0);

        const words = rescueFile().mnemonic.split(" ");
        const groups = Array.from({ length: 3 }, (_, i) => {
            const start = i * 4;
            return {
                mnemonicList: words.slice(start, start + 4),
                mnemonicWord: Math.floor(Math.random() * 4),
            };
        });

        const isVerificationWord = (index: number) => {
            return index === groups[displayedGroup()].mnemonicWord;
        };

        const getWordNumber = (index: number) =>
            index + 1 + displayedGroup() * 4;

        const generateWordButtons = () => {
            const group = groups[displayedGroup()];
            const correctWordIndex = Math.floor(
                Math.random() * group.mnemonicList.length,
            );

            const generateFakeWord = () => {
                return wordlist.filter(
                    (word) => !group.mnemonicList.includes(word),
                )[
                    Math.floor(
                        Math.random() *
                            (wordlist.length - group.mnemonicList.length - 1),
                    )
                ];
            };

            return (
                <div style={{ width: "100%" }}>
                    <For each={Array.from({ length: 4 }, (_, i) => i)}>
                        {(wordIndex) => (
                            <button
                                class="btn btn-light"
                                style={{ margin: "0.8rem 0" }}
                                onClick={async () => {
                                    if (wordIndex !== correctWordIndex) {
                                        notify("error", t("incorrect_word"));
                                        return navigate("/backup");
                                    }
                                    if (
                                        displayedGroup() ===
                                        groups.length - 1
                                    ) {
                                        setRescueFileBackupDone(true);
                                        await handleBackupDone();
                                    }
                                    setDisplayedGroup(displayedGroup() + 1);
                                }}>
                                <Switch>
                                    <Match
                                        when={wordIndex === correctWordIndex}>
                                        {group.mnemonicList[group.mnemonicWord]}
                                    </Match>
                                    <Match
                                        when={wordIndex !== correctWordIndex}>
                                        {generateFakeWord()}
                                    </Match>
                                </Switch>
                            </button>
                        )}
                    </For>
                </div>
            );
        };

        return (
            <div class="mnemonic-backup-verify-container">
                <h2>{t("verify_boltz_rescue_key")}</h2>
                <p>
                    {t("verify_mnemonic_word.start")}
                    <strong class="text-highlight">
                        {t("verify_mnemonic_word.strong", {
                            number:
                                groups[displayedGroup()].mnemonicWord +
                                1 +
                                displayedGroup() * 4,
                        })}
                    </strong>
                    {t("verify_mnemonic_word.end")}
                </p>
                <div class="mnemonic-verification">
                    <For each={groups[displayedGroup()].mnemonicList}>
                        {(word, index) => (
                            <span
                                class="mnemonic-item"
                                classList={{
                                    "verification-item":
                                        isVerificationWord(index()),
                                }}>
                                <span class="mnemonic-number">
                                    {getWordNumber(index())}
                                </span>
                                <span class="mnemonic-word">
                                    <Show when={!isVerificationWord(index())}>
                                        {word}
                                    </Show>
                                </span>
                            </span>
                        )}
                    </For>
                </div>
                {generateWordButtons()}
            </div>
        );
    };

    return (
        <div class="frame">
            <Switch>
                <Match when={false}>
                    <BackupVerifyFile />
                </Match>
                <Match when={true}>
                    <BackupVerifyMnemonic />
                </Match>
            </Switch>
        </div>
    );
};

export default BackupVerify;
