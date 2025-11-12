import { wordlist } from "@scure/bip39/wordlists/english.js";
import { useNavigate } from "@solidjs/router";
import { For, createMemo, createSignal } from "solid-js";
import { Match, Show, Switch } from "solid-js";

import { BackupDone } from "../components/CreateButton";
import { useGlobalContext } from "../context/Global";

const MnemonicVerify = () => {
    const navigate = useNavigate();
    const { t, rescueFile, notify, setRescueFileBackupDone } =
        useGlobalContext();

    const [displayedGroup, setDisplayedGroup] = createSignal<number>(0);

    const groupSize = 4;
    const mnemonicGroups = createMemo(() => {
        if (rescueFile()) {
            const mnemonicWords = rescueFile().mnemonic.split(" ");
            const newGroups = Array.from(
                { length: mnemonicWords.length / groupSize },
                (_, index) => {
                    const start = index * groupSize;
                    const verificationIndex = Math.floor(
                        Math.random() * groupSize,
                    );
                    return {
                        verificationIndex,
                        verificationWord: mnemonicWords.slice(
                            start,
                            start + groupSize,
                        )[verificationIndex],
                    };
                },
            );
            return newGroups;
        }
        return [];
    }, rescueFile());

    const generateFakeWord = () => {
        return wordlist.filter(
            (word) =>
                mnemonicGroups()[displayedGroup()]?.verificationWord !== word,
        )[Math.floor(Math.random() * (wordlist.length - groupSize - 1))];
    };

    const isVerificationWord = (index: number) => {
        return index === mnemonicGroups()[displayedGroup()]?.verificationIndex;
    };

    const getWordNumber = (index: number) =>
        index + 1 + displayedGroup() * groupSize;

    return (
        <div class="frame">
            <div class="mnemonic-backup-verify-container">
                <h2>{t("verify_boltz_rescue_key")}</h2>
                <p>
                    {t("verify_mnemonic_word.start")}
                    <strong class="text-highlight">
                        {t("verify_mnemonic_word.strong", {
                            number:
                                mnemonicGroups()[displayedGroup()]
                                    ?.verificationIndex +
                                1 +
                                displayedGroup() * groupSize,
                        })}
                    </strong>
                    {t("verify_mnemonic_word.end")}
                </p>
                <div
                    class="verification-words"
                    data-testid="verification-words">
                    <For each={Array.from({ length: groupSize }, (_, i) => i)}>
                        {(wordIndex) => (
                            <span
                                class="mnemonic-item"
                                classList={{
                                    "verification-item":
                                        isVerificationWord(wordIndex),
                                }}>
                                <span class="mnemonic-number">
                                    {getWordNumber(wordIndex)}
                                </span>
                                <span class="text-bold">
                                    <Show when={!isVerificationWord(wordIndex)}>
                                        {
                                            rescueFile()
                                                ?.mnemonic.split(" ")
                                                .slice(
                                                    displayedGroup() *
                                                        groupSize,
                                                    displayedGroup() *
                                                        groupSize +
                                                        groupSize,
                                                )[wordIndex]
                                        }
                                    </Show>
                                </span>
                            </span>
                        )}
                    </For>
                </div>
                <div
                    class="verification-buttons"
                    data-testid="verification-buttons">
                    <For each={Array.from({ length: groupSize }, (_, i) => i)}>
                        {(wordIndex) => (
                            <button
                                class="btn btn-light"
                                style={{ margin: "0.8rem 0" }}
                                onClick={() => {
                                    if (
                                        wordIndex !==
                                        mnemonicGroups()[displayedGroup()]
                                            ?.verificationIndex
                                    ) {
                                        notify("error", t("incorrect_word"));
                                        return navigate("/backup/mnemonic");
                                    }
                                    if (
                                        displayedGroup() ===
                                        mnemonicGroups().length - 1
                                    ) {
                                        setRescueFileBackupDone(true);
                                        navigate("/swap", {
                                            state: {
                                                backupDone: BackupDone.True,
                                            },
                                        });
                                    }
                                    setDisplayedGroup(displayedGroup() + 1);
                                }}>
                                <Switch>
                                    <Match
                                        when={
                                            wordIndex ===
                                            mnemonicGroups()[displayedGroup()]
                                                ?.verificationIndex
                                        }>
                                        {
                                            mnemonicGroups()[displayedGroup()]
                                                ?.verificationWord
                                        }
                                    </Match>
                                    <Match
                                        when={
                                            wordIndex !==
                                            mnemonicGroups()[displayedGroup()]
                                                ?.verificationIndex
                                        }>
                                        {generateFakeWord()}
                                    </Match>
                                </Switch>
                            </button>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
};

export default MnemonicVerify;
