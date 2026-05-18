import { useSearchParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { IoKey } from "solid-icons/io";
import { Match, Show, Switch, createEffect } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { rescueKeyMode, useRescueContext } from "../context/Rescue";
import type { DictKey } from "../i18n/i18n";
import { formatError } from "../utils/errors";
import { type RescueFile, validateRescueFile } from "../utils/rescueFile";
import MnemonicInput from "./MnemonicInput";
import RescueFileInput from "./RescueFileInput";

export enum RescueFileError {
    InvalidData,
}

export type RescueFileResult = {
    data: RescueFile;
    fileName?: string;
    fileNameKey?: DictKey;
};

type RescueFileUploadProps = {
    onFileValidated: (result: RescueFileResult) => void;
    onError: (error: RescueFileError) => void;
    onReset?: () => void;
    showMnemonicOption?: boolean;
    autoSubmitMnemonic?: boolean;
    mnemonicBackLabel?: DictKey;
    fileName?: string | null;
    errorKey?: DictKey;
};

export const checkRefundJsonKeys = (
    json: Record<string, string | object | number>,
): RescueFile => {
    log.debug("checking refund json");

    if ("mnemonic" in json) {
        log.info("Found rescue file");
        return validateRescueFile(json);
    }

    throw new Error("not a rescue file");
};

export const processUploadedFile = async (
    inputFile: File,
): Promise<RescueFile> => {
    if (["image/png", "image/jpg", "image/jpeg"].includes(inputFile.type)) {
        const res = await QrScanner.scanImage(inputFile, {
            returnDetailedScanResult: true,
        });
        return checkRefundJsonKeys(JSON.parse(res.data));
    } else {
        const data = await inputFile.text();
        return checkRefundJsonKeys(JSON.parse(data));
    }
};

const RescueFileUpload = (props: RescueFileUploadProps) => {
    const { t } = useGlobalContext();
    const {
        rescueFile,
        setRescueFile,
        setRescuableSwaps,
        validRescueKey,
        resetRescueKey,
    } = useRescueContext();
    const [searchParams, setSearchParams] = useSearchParams();

    const showMnemonicOption = () => props.showMnemonicOption ?? true;
    let submittedMnemonic: string | undefined;

    const handleReset = () => {
        submittedMnemonic = undefined;
        props.onReset?.();
        resetRescueKey();
        setSearchParams({
            page: null,
            mode: null,
        });
    };

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files?.[0];
        if (inputFile === undefined) {
            return;
        }

        handleReset();

        try {
            const result = await processUploadedFile(inputFile);

            setRescueFile(result);

            props.onFileValidated({
                data: result,
                fileName: inputFile.name,
            });
        } catch (e) {
            log.error("invalid file upload", formatError(e));
            props.onError(RescueFileError.InvalidData);
        }
    };

    const handleMnemonicSubmit = () => {
        const data = rescueFile();
        if (!data) return;

        props.onFileValidated({
            data,
            fileNameKey: "rescue_key",
        });

        setSearchParams({
            mode: null,
        });
    };

    createEffect(() => {
        if (!props.autoSubmitMnemonic || searchParams.mode !== rescueKeyMode) {
            return;
        }

        const data = rescueFile();
        if (!validRescueKey() || !data || data.mnemonic === submittedMnemonic) {
            return;
        }

        submittedMnemonic = data.mnemonic;
        handleMnemonicSubmit();
    });

    return (
        <>
            <Show when={searchParams.mode === rescueKeyMode}>
                <p class="frame-text">{t("rescue_a_swap_mnemonic")}</p>
                <MnemonicInput />
                <Show when={!props.autoSubmitMnemonic}>
                    <button
                        class="btn btn-yellow"
                        data-testid="import-key-button"
                        aria-invalid={!validRescueKey()}
                        disabled={!validRescueKey()}
                        onClick={handleMnemonicSubmit}>
                        <span>{t("verify_key")}</span>
                    </button>
                </Show>
            </Show>
            <Switch>
                <Match when={searchParams.mode !== rescueKeyMode}>
                    <RescueFileInput
                        required
                        id="refundUpload"
                        data-testid="refundUpload"
                        displayFileName={props.fileName ?? undefined}
                        error={
                            props.errorKey !== undefined
                                ? t(props.errorKey)
                                : undefined
                        }
                        onChange={(e) => uploadChange(e)}
                        onClear={handleReset}
                    />
                    <Show when={!props.fileName && !props.errorKey}>
                        <p style={{ margin: "5px 0" }}>{t("or")}</p>
                        <Show when={showMnemonicOption()}>
                            <button
                                class="btn btn-light"
                                data-testid="enterMnemonicBtn"
                                onClick={() => {
                                    handleReset();
                                    setRescuableSwaps([]);
                                    setSearchParams({
                                        page: null,
                                        mode: rescueKeyMode,
                                    });
                                }}>
                                <IoKey size={14} />
                                {t("enter_mnemonic")}
                            </button>
                        </Show>
                    </Show>
                </Match>
                <Match when={searchParams.mode === rescueKeyMode}>
                    <button
                        class="btn btn-light"
                        data-testid="backBtn"
                        onClick={() => {
                            submittedMnemonic = undefined;
                            resetRescueKey();
                            setSearchParams({
                                mode: null,
                            });
                        }}>
                        {t(props.mnemonicBackLabel ?? "back")}
                    </button>
                </Match>
            </Switch>
        </>
    );
};

export default RescueFileUpload;
