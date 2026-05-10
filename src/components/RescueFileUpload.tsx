import { useSearchParams } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Match, Show, Switch } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { rescueKeyMode, useRescueContext } from "../context/Rescue";
import { formatError } from "../utils/errors";
import { type RescueFile, validateRescueFile } from "../utils/rescueFile";
import MnemonicInput from "./MnemonicInput";
import RescueFileInput from "./RescueFileInput";

export enum RescueFileError {
    InvalidData,
}

type RescueFileUploadProps = {
    onFileValidated: (data: RescueFile) => void;
    onError: (error: RescueFileError) => void;
    onReset?: () => void;
    showMnemonicOption?: boolean;
};

export const checkRefundJsonKeys = (
    json: Record<string, string | object | number>,
): RescueFile => {
    log.debug("checking refund json");

    if (!("mnemonic" in json)) {
        throw new Error("not a rescue file");
    }

    log.info("Found rescue file");
    return validateRescueFile(json);
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
        const inputFile = input.files?.[0];
        if (inputFile === undefined) {
            return;
        }

        handleReset();

        try {
            const result = await processUploadedFile(inputFile);
            setRescueFile(result);
            props.onFileValidated(result);
        } catch (e) {
            log.error("invalid file upload", formatError(e));
            props.onError(RescueFileError.InvalidData);
        }
    };

    const handleMnemonicSubmit = () => {
        const data = rescueFile();
        if (!data) return;

        props.onFileValidated(data);

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
                    <RescueFileInput
                        required
                        id="refundUpload"
                        data-testid="refundUpload"
                        onChange={(e) => uploadChange(e)}
                        onClear={handleReset}
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
