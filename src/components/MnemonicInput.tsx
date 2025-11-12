import { wordlist } from "@scure/bip39/wordlists/english.js";
import log from "loglevel";
import { For, Show, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { validateRescueFile } from "../utils/rescueFile";

export const mnemonicLength = 12;
export const rescueKeyMode = "rescue-key";

const MnemonicInput = (props: { onSubmit: (mnemonic: string) => void }) => {
    const { t } = useGlobalContext();

    const [rescueKey, setRescueKey] = createSignal<string[]>(
        Array.from({ length: mnemonicLength }, () => ""),
    );

    const [focusedIndex, setFocusedIndex] = createSignal<number>(0);
    const [validRescueKey, setValidRescueKey] = createSignal<boolean>(false);

    const inputRefs: HTMLInputElement[] = Array(mnemonicLength);

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

    const handleInput = (
        e: InputEvent & { currentTarget: HTMLInputElement },
    ) => {
        const value = e.currentTarget.value;

        if (value === "Enter" || value === " ") {
            return;
        }

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
        const pastedText = e.clipboardData.getData("text/plain").trim();
        const words = pastedText.split(/[\s\n]+/);
        const is12WordMnemonic = words.length === mnemonicLength;

        if (is12WordMnemonic) {
            words.forEach((word, index) => {
                validateWord(inputRefs[index], word);
            });
            setRescueKey(words);
            validateMnemonic();

            const lastIndex = words.length - 1;
            setFocusedIndex(lastIndex);
            inputRefs[lastIndex]?.focus();
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
                <For each={Array.from({ length: mnemonicLength })}>
                    {(_, i) => (
                        <div class="input-box">
                            <span class="mnemonic-number">#{i() + 1}</span>
                            <input
                                id={`mnemonic-input-${i()}`}
                                class="mnemonic-input"
                                data-testid={`mnemonic-input-${i()}`}
                                type="text"
                                ref={inputRefs[i()]}
                                autofocus={i() === 0}
                                value={rescueKey()[i()]}
                                onFocus={() => setFocusedIndex(i())}
                                onInput={handleInput}
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
                data-testid="import-key-button"
                aria-invalid={!validRescueKey()}
                disabled={
                    rescueKey().every((word) => word === "") ||
                    !validRescueKey()
                }
                onClick={() => {
                    try {
                        validateRescueFile({ mnemonic: rescueKey().join(" ") });
                        props.onSubmit(rescueKey().join(" "));
                    } catch (e) {
                        log.error(e);
                        setValidRescueKey(false);
                    }
                }}>
                <Show
                    when={
                        validRescueKey() ||
                        rescueKey().some((word) => word === "")
                    }
                    fallback={<span>{t("invalid_refund_file")}</span>}>
                    <span>{t("verify_key")}</span>
                </Show>
            </button>
        </div>
    );
};

export default MnemonicInput;
