import { wordlist } from "@scure/bip39/wordlists/english";
import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { For, createSignal } from "solid-js";
import { Match, Show, Switch } from "solid-js";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { validateRescueFile } from "../utils/rescueFile";
import { backupDone } from "./Backup";

const MnemonicVerify = () => {
    const navigate = useNavigate();
    const {
        t,
        rescueFile,
        notify,
        setRescueFileBackupDone,
        newKey,
        deriveKey,
        ref,
        rescueFileBackupDone,
        pairs,
        setPairs,
        setSwapStorage,
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

    const getWordNumber = (index: number) => index + 1 + displayedGroup() * 4;

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
                                    return navigate("/backup/mnemonic");
                                }
                                if (displayedGroup() === groups.length - 1) {
                                    setRescueFileBackupDone(true);
                                    await handleBackupDone();
                                }
                                setDisplayedGroup(displayedGroup() + 1);
                            }}>
                            <Switch>
                                <Match when={wordIndex === correctWordIndex}>
                                    {group.mnemonicList[group.mnemonicWord]}
                                </Match>
                                <Match when={wordIndex !== correctWordIndex}>
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
        <div class="frame">
            <div class="mnemonic-backup-verify-container">
                <h2>{t("import_boltz_rescue_key")}</h2>
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
                                <span class="text-bold">
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
        </div>
    );
};

const MnemonicLength = 12;

export const MnemonicInput = (props: {
    onSubmit: (mnemonic: string) => void;
}) => {
    const { t } = useGlobalContext();

    const [rescueKey, setRescueKey] = createSignal<string[]>(
        Array.from({ length: MnemonicLength }, () => ""),
    );

    const [focusedIndex, setFocusedIndex] = createSignal<number>(0);
    const [validRescueKey, setValidRescueKey] = createSignal<boolean>(false);

    const inputRefs: HTMLInputElement[] = Array(MnemonicLength);

    const validateWord = (inputElement: HTMLInputElement, word: string) => {
        if (wordlist.includes(word) || word === "") {
            inputElement.classList.remove("invalid");
        } else {
            inputElement.classList.add("invalid");
        }
    };

    const validateMnemonic = () => {
        try {
            validateRescueFile({
                mnemonic: rescueKey().join(" "),
            });
            log.info("Valid rescue key inserted");
            setValidRescueKey(true);
        } catch {
            log.info("Invalid rescue key inserted");
            setValidRescueKey(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        // Enter and space act as tab
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRefs[focusedIndex() + 1]?.focus();
            return;
        }
    };

    const handleKeyUp = (
        e: KeyboardEvent & { currentTarget: HTMLInputElement },
    ) => {
        if (e.key === "Enter" || e.key === " ") {
            return;
        }
        const value = e.currentTarget.value;
        setRescueKey((prev) => {
            const newRescueKey = [...prev];
            newRescueKey[focusedIndex()] = value;
            return newRescueKey;
        });
        validateWord(e.currentTarget, value.toLowerCase());

        if (rescueKey().every((word) => word !== "")) {
            validateMnemonic();
        }
    };

    const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text/plain");
        const words = pastedText.split(" ");
        const is12WordMnemonic = words.length === MnemonicLength;

        if (is12WordMnemonic) {
            words.forEach((word, index) => {
                validateWord(inputRefs[index], word);
            });
            setRescueKey(words);
            validateMnemonic();
            return;
        }

        setRescueKey((prev) => {
            const newRescueKey = [...prev];
            newRescueKey[focusedIndex()] = pastedText;
            return newRescueKey;
        });
        validateWord(inputRefs[focusedIndex()], pastedText.toLowerCase());
    };

    return (
        <div class="mnemonic-input-container">
            <div class="mnemonic-inputs">
                <For each={Array.from({ length: MnemonicLength })}>
                    {(_, i) => (
                        <div class="input-box">
                            <span class="mnemonic-number">#{i() + 1}</span>
                            <input
                                id={`mnemonic-input-${i()}`}
                                ref={inputRefs[i()]}
                                autofocus={i() === 0}
                                type="text"
                                class="mnemonic-input"
                                value={rescueKey()[i()]}
                                onFocus={() => setFocusedIndex(i())}
                                onKeyUp={handleKeyUp}
                                onPaste={handlePaste}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    )}
                </For>
            </div>
            <i>{t("hint_paste_mnemonic")}</i>
            <button
                class="btn btn-yellow"
                disabled={
                    rescueKey().every((word) => word === "") ||
                    !validRescueKey()
                }
                onClick={() => {
                    try {
                        validateRescueFile({ mnemonic: rescueKey().join(" ") });
                        props.onSubmit(rescueKey().join(" "));
                    } catch {
                        setValidRescueKey(false);
                    }
                }}>
                <Show
                    when={
                        validRescueKey() ||
                        rescueKey().some((word) => word === "")
                    }
                    fallback={<span>{t("invalid_refund_file")}</span>}>
                    <span>{t("import_key")}</span>
                </Show>
            </button>
        </div>
    );
};

export default MnemonicVerify;
