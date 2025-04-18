import type { Navigator } from "@solidjs/router";
import { useNavigate } from "@solidjs/router";
import type BigNumber from "bignumber.js";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import log from "loglevel";
import type { Accessor, Setter } from "solid-js";
import { For, Match, Switch, createEffect } from "solid-js";

import CopyButton from "../components/CopyButton";
import { createSwap, getClaimAddress } from "../components/CreateButton";
import Warning from "../components/Warning";
import type { SwapType } from "../consts/Enums";
import type { EIP6963ProviderDetail } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import type { deriveKeyFn, newKeyFn, notifyFn, tFn } from "../context/Global";
import { useGlobalContext } from "../context/Global";
import type { Signer } from "../context/Web3";
import { useWeb3Signer } from "../context/Web3";
import type { Pairs } from "../utils/boltzClient";
import { downloadJson } from "../utils/download";
import { isMobile } from "../utils/helper";
import type { RescueFile } from "../utils/rescueFile";
import type { SomeSwap } from "../utils/swapCreator";
import { existingBackupFileType } from "./BackupVerify";

const rescueFileName = "boltz-rescue-key-DO-NOT-DELETE";

export const downloadRescueFile = (rescueFile: Accessor<RescueFile>) => {
    downloadJson(rescueFileName, rescueFile());
};

export const backupDone = async (
    navigate: Navigator,
    t: tFn,
    notify: notifyFn,
    newKey: newKeyFn,
    deriveKey: deriveKeyFn,
    valid: Accessor<boolean>,

    ref: Accessor<string>,
    rescueFileBackupDone: Accessor<boolean>,
    pairs: Accessor<Pairs>,
    swapType: Accessor<SwapType>,
    assetSend: Accessor<string>,
    assetReceive: Accessor<string>,
    sendAmount: Accessor<BigNumber>,
    receiveAmount: Accessor<BigNumber>,
    invoice: Accessor<string>,
    onchainAddress: Accessor<string>,
    signer: Accessor<Signer>,
    providers: Accessor<Record<string, EIP6963ProviderDetail>>,
    getEtherSwap: () => EtherSwap,
    hasBrowserWallet: Accessor<boolean>,

    setPairs: Setter<Pairs>,
    setInvoice: Setter<string>,
    setInvoiceValid: Setter<boolean>,
    setOnchainAddress: Setter<string>,
    setAddressValid: Setter<boolean>,
    setSwapStorage: (swap: SomeSwap) => Promise<void>,
) => {
    if (!valid()) {
        log.warn("Invalid swap creation data, redirecting to home");
        navigate("/");
        return;
    }

    try {
        log.info("Creating swap");
        const { claimAddress, useRif } = await getClaimAddress(
            assetReceive,
            signer,
            onchainAddress,
        );

        if (
            !(await createSwap(
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
                signer,
                providers,
                getEtherSwap,
                hasBrowserWallet,
                claimAddress,
                useRif,
                setPairs,
                setInvoice,
                setInvoiceValid,
                setOnchainAddress,
                setAddressValid,
                setSwapStorage,
            ))
        ) {
            navigate("/swap");
            return;
        }
    } catch (e) {
        log.error("Error creating swap", e);
        notify("error", e);
        navigate("/swap");
    }
};

const Backup = () => {
    const navigate = useNavigate();
    const isMobileEvmBrowser = () => isMobile() && hasBrowserWallet();
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

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (rescueFileBackupDone()) {
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
        }
    });

    const navigateToVerification = (existingFile: boolean) => {
        const basePath = "/backup/verify";
        navigate(
            existingFile ? `${basePath}/${existingBackupFileType}` : basePath,
        );
    };

    const BackupFile = () => (
        <>
            <h2>{t("download_boltz_rescue_key")}</h2>
            <h4>{t("download_boltz_rescue_key_subline")}</h4>
            <p>{t("download_boltz_rescue_key_subline_second")}</p>
            <Warning />
            <p>{t("download_boltz_rescue_key_subline_third")}</p>
            <div class="btns">
                <button
                    class="btn btn-light"
                    onClick={() => {
                        navigateToVerification(true);
                    }}>
                    {t("verify_key")}
                </button>
                <button
                    class="btn"
                    onClick={() => {
                        downloadRescueFile(rescueFile);
                        navigateToVerification(false);
                    }}>
                    {t("download_new_key")}
                </button>
            </div>
        </>
    );

    const BackupMnemonic = () => (
        <>
            <h2>{t("backup_boltz_rescue_key")}</h2>
            <h4>{t("download_boltz_rescue_key_subline")}</h4>
            {/* <Warning /> */}
            <p>{t("backup_boltz_rescue_key_subline_second")}</p>
            <div class="backup-mnemonic-container">
                <div class="mnemonic-wordlist">
                    <For each={rescueFile().mnemonic.split(" ")}>
                        {(word, i) => (
                            <div class="mnemonic-item">
                                <span class="mnemonic-number">{i() + 1}</span>
                                <span class="mnemonic-word">{word}</span>
                            </div>
                        )}
                    </For>
                </div>
            </div>
            <p class="mnemonic-word">
                {t("backup_boltz_rescue_key_reminder").toUpperCase()}
            </p>
            <p>{t("backup_boltz_rescue_key_subline_third")}</p>
            <CopyButton
                label="copy_rescue_key"
                btnClass="btn btn-light"
                data={rescueFile().mnemonic}
            />
            <hr />
            <button
                class="btn btn-yellow"
                onClick={() => {
                    navigateToVerification(true);
                }}>
                {t("user_saved_key")}
            </button>
        </>
    );

    return (
        <div class="frame">
            <Switch>
                <Match when={!isMobileEvmBrowser()}>
                    <BackupFile />
                </Match>
                <Match when={isMobileEvmBrowser()}>
                    <BackupMnemonic />
                </Match>
            </Switch>
        </div>
    );
};

export default Backup;
