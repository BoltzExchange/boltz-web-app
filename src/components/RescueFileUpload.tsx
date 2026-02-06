import { useSearchParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Match, Show, Switch } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { rescueKeyMode, useRescueContext } from "../context/Rescue";
import { rescueFileTypes } from "../utils/download";
import { formatError } from "../utils/errors";
import { validateRefundFile } from "../utils/refundFile";
import type { RescueFile } from "../utils/rescueFile";
import { validateRescueFile } from "../utils/rescueFile";
import MnemonicInput from "./MnemonicInput";

export enum RescueFileType {
    Rescue,
    Legacy,
}

export enum RescueFileError {
    InvalidData,
}

export type LegacyRefundData = { id: string } & Record<
    string,
    string | object | number | boolean
>;

export type RescueFileResult = {
    type: RescueFileType;
    data: RescueFile | LegacyRefundData;
};

type RescueFileUploadProps = {
    onFileValidated: (result: RescueFileResult) => void;
    onError: (error: RescueFileError) => void;
    onReset?: () => void;
    showMnemonicOption?: boolean;
};

export const checkRefundJsonKeys = (
    json: Record<string, string | object | number>,
): RescueFileResult => {
    log.debug("checking refund json");

    if ("mnemonic" in json) {
        log.info("Found rescue file");
        return {
            type: RescueFileType.Rescue,
            data: validateRescueFile(json),
        };
    } else {
        log.info("Found legacy refund file");
        return {
            type: RescueFileType.Legacy,
            data: validateRefundFile(json),
        };
    }
};

export const processUploadedFile = async (
    inputFile: File,
): Promise<RescueFileResult> => {
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

    const handleReset = () => {
        props.onReset?.();
        resetRescueKey();
        setSearchParams({
            page: null,
            mode: null,
        });
    };

    const uploadChange = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];

        handleReset();

        try {
            const result = await processUploadedFile(inputFile);

            if (result.type === RescueFileType.Rescue) {
                setRescueFile(result.data as RescueFile);
            }

            props.onFileValidated(result);
        } catch (e) {
            log.error("invalid file upload", formatError(e));
            props.onError(RescueFileError.InvalidData);
        }
    };

    const handleMnemonicSubmit = () => {
        const data = rescueFile();
        if (!data) return;

        props.onFileValidated({
            type: RescueFileType.Rescue,
            data,
        });

        setSearchParams({
            mode: null,
        });
    };

    return (
        <>
            <Show when={searchParams.mode === rescueKeyMode}>
                <p class="frame-text">{t("rescue_a_swap_mnemonic")}</p>
                <MnemonicInput />
                <button
                    class="btn btn-yellow"
                    data-testid="import-key-button"
                    aria-invalid={!validRescueKey()}
                    disabled={!validRescueKey()}
                    onClick={handleMnemonicSubmit}>
                    <span>{t("verify_key")}</span>
                </button>
            </Show>
            <Switch>
                <Match when={searchParams.mode !== rescueKeyMode}>
                    <input
                        required
                        type="file"
                        id="refundUpload"
                        data-testid="refundUpload"
                        accept={rescueFileTypes}
                        onChange={(e) => uploadChange(e)}
                    />
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
                            {t("enter_mnemonic")}
                        </button>
                    </Show>
                </Match>
                <Match when={searchParams.mode === rescueKeyMode}>
                    <button
                        class="btn btn-light"
                        data-testid="backBtn"
                        onClick={() => {
                            resetRescueKey();
                            setSearchParams({
                                mode: null,
                            });
                        }}>
                        {t("back")}
                    </button>
                </Match>
            </Switch>
        </>
    );
};

export default RescueFileUpload;
