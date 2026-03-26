import { Match, Switch, createEffect, createSignal, on } from "solid-js";

import BackupDownloadContent from "./BackupDownloadContent";
import BackupVerifyContent from "./BackupVerifyContent";
import MnemonicBackupContent from "./MnemonicBackupContent";
import MnemonicVerifyContent from "./MnemonicVerifyContent";

export const enum BackupStep {
    Download = "download",
    Verify = "verify",
    Mnemonic = "mnemonic",
    MnemonicVerify = "mnemonicVerify",
}

type BackupFlowProps = {
    initialStep?: BackupStep;
    resetKey?: string;
};

const BackupFlow = (props: BackupFlowProps) => {
    const [localStep, setLocalStep] = createSignal<BackupStep>(
        props.initialStep ?? BackupStep.Download,
    );

    createEffect(
        on(
            () => props.resetKey,
            () => {
                setLocalStep(props.initialStep ?? BackupStep.Download);
            },
            { defer: true },
        ),
    );

    return (
        <Switch
            fallback={
                <BackupDownloadContent
                    onFileDownloaded={() => setLocalStep(BackupStep.Verify)}
                    onMnemonicRequested={() =>
                        setLocalStep(BackupStep.Mnemonic)
                    }
                />
            }>
            <Match when={localStep() === BackupStep.Verify}>
                <BackupVerifyContent
                    onRetry={() => setLocalStep(BackupStep.Download)}
                />
            </Match>
            <Match when={localStep() === BackupStep.Mnemonic}>
                <MnemonicBackupContent
                    onSaved={() => setLocalStep(BackupStep.MnemonicVerify)}
                />
            </Match>
            <Match when={localStep() === BackupStep.MnemonicVerify}>
                <MnemonicVerifyContent
                    onIncorrect={() => setLocalStep(BackupStep.Mnemonic)}
                />
            </Match>
        </Switch>
    );
};

export default BackupFlow;
