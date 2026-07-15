import { BsInfoCircleFill } from "solid-icons/bs";
import { For, Show, createSignal } from "solid-js";

import ConnectWallet from "../../components/ConnectWallet";
import RescueFileUpload from "../../components/RescueFileUpload";
import { useGlobalContext } from "../../context/Global";
import { isChatwootConfigured, postLogsToChatwoot } from "../../utils/chatwoot";
import { RecoveryChip, missingMethodsTitle, recoveryOptions } from "./Recovery";
import { RecoveryMethod } from "./types";
import type { ExternalRescueSearch } from "./useExternalRescueSearch";

type MethodSelectionProps = {
    actions: ExternalRescueSearch["actions"];
    selection: ExternalRescueSearch["selection"];
};

export const MethodSelection = (props: MethodSelectionProps) => {
    const { t, getLogs, notify } = useGlobalContext();
    const activeMethods = () => props.selection.activeMethods();

    const [sharingLogs, setSharingLogs] = createSignal(false);

    const shareLogs = async () => {
        if (sharingLogs()) {
            return;
        }

        setSharingLogs(true);
        try {
            await postLogsToChatwoot(await getLogs());
        } catch (error) {
            notify(
                "error",
                error instanceof Error ? error.message : String(error),
            );
        } finally {
            setSharingLogs(false);
        }
    };

    return (
        <>
            <p class="frame-text rescue-external-subtitle">
                {t("rescue_external_subtitle")}
            </p>

            <hr />
            <RescueFileUpload
                onFileValidated={props.actions.handleFileValidated}
                onError={props.actions.handleFileError}
                onReset={props.actions.handleReset}
                autoSubmitMnemonic
                mnemonicBackLabel="upload_rescue_key"
                fileName={props.selection.rescueFileDisplayName()}
                errorKey={props.selection.fileErrorKey()}
            />
            <hr />
            <div
                class="rescue-external-wallet-slot"
                data-connected={
                    activeMethods().includes(RecoveryMethod.Wallet)
                        ? "true"
                        : "false"
                }>
                <ConnectWallet showWalletIcon />
            </div>
            <hr />

            <div
                class="rescue-external-coverage"
                data-empty={!props.selection.canSearch() ? "true" : "false"}>
                <p>{t("rescue_external_coverage")}</p>
                <div class="rescue-external-chip-list">
                    <For each={recoveryOptions}>
                        {(option) => (
                            <RecoveryChip
                                {...option}
                                active={props.selection.canRecover(option)}
                                activeMethods={activeMethods()}
                                t={t}
                                tooltip={missingMethodsTitle(
                                    option.methods,
                                    activeMethods(),
                                    t,
                                )}
                            />
                        )}
                    </For>
                </div>
            </div>

            <div class="btns rescue-external-actions">
                <button
                    class="btn"
                    type="button"
                    disabled={!props.selection.canSearch()}
                    onClick={() => void props.actions.startSearch()}>
                    {props.selection.searchText()}
                </button>
            </div>

            <Show when={isChatwootConfigured()}>
                <p class="rescue-external-report-hint">
                    <BsInfoCircleFill size={16} opacity={0.5} />
                    {t("rescue_external_report_issue_start")}
                    <a
                        class="rescue-external-report-link"
                        onClick={() => void shareLogs()}
                        data-testid="rescue-share-logs">
                        {t("rescue_external_report_issue_link")}
                    </a>
                    {t("rescue_external_report_issue_end")}
                </p>
            </Show>
        </>
    );
};
