import { wordlist } from "@scure/bip39/wordlists/english";
import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { For, createMemo, createSignal } from "solid-js";
import { Match, Show, Switch } from "solid-js";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
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
    } = useCreateContext();
    const { signer, providers, getEtherSwap, hasBrowserWallet } =
        useWeb3Signer();

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
                                onClick={async () => {
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
                                        await handleBackupDone();
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
