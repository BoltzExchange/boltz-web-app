import { wordlist } from "@scure/bip39/wordlists/english.js";
import log from "loglevel";
import { For, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { mnemonicLength, useRescueContext } from "../context/Rescue";
import { validateRescueFile } from "../utils/rescueFile";

const MnemonicInput = () => {
    const { t } = useGlobalContext();
    const { setRescueFile, setValidRescueKey } = useRescueContext();

    const [words, setWords] = createSignal<string[]>(
        Array.from({ length: mnemonicLength }, () => ""),
    );
    const [focusedIndex, setFocusedIndex] = createSignal<number>(0);

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
            const mnemonic = words().join(" ");
            const data = validateRescueFile({ mnemonic });
            log.info("Valid rescue key inserted");
            setRescueFile(data);
            setValidRescueKey(true);
        } catch {
            log.info("Invalid rescue key inserted");
            setValidRescueKey(false);
            setRescueFile(undefined);
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

        const index = focusedIndex();
        setWords((prev) => {
            const newWords: string[] = [...prev];
            newWords[index] = value.toLowerCase();
            return newWords;
        });

        validateWord(e.currentTarget, value.toLowerCase());

        if (words().every((word) => word !== "")) {
            validateMnemonic();
        }
    };

    const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text/plain").trim();
        const pastedWords = pastedText
            .split(/[\s\n]+/)
            .map((w) => w.toLowerCase());
        const is12WordMnemonic = pastedWords.length === mnemonicLength;

        if (is12WordMnemonic) {
            pastedWords.forEach((word, index) => {
                validateWord(inputRefs[index], word);
            });
            setWords(pastedWords);
            validateMnemonic();

            const lastIndex = pastedWords.length - 1;
            setFocusedIndex(lastIndex);
            inputRefs[lastIndex]?.focus();
            return;
        }

        const index = focusedIndex();
        setWords((prev) => {
            const newWords: string[] = [...prev];
            newWords[index] = pastedText.toLowerCase();
            return newWords;
        });
        validateWord(inputRefs[index], pastedText.toLowerCase());
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
                                value={words()[i()]}
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
        </div>
    );
};

export default MnemonicInput;
