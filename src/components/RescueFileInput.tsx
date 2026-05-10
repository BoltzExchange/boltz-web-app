import { IoClose, IoKey } from "solid-icons/io";
import {
    type ComponentProps,
    Show,
    createEffect,
    createSignal,
    splitProps,
} from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/rescueFileInput.scss";
import { rescueFileTypes } from "../utils/download";

type RescueFileInputProps = Omit<
    ComponentProps<"input">,
    "accept" | "type" | "onChange"
> & {
    id: string;
    displayFileName?: string;
    onChange: (event: Event) => void;
    onClear?: () => void;
};

const RescueFileInput = (props: RescueFileInputProps) => {
    const { t } = useGlobalContext();
    const [, inputProps] = splitProps(props, [
        "displayFileName",
        "onChange",
        "onClear",
    ]);
    const [selectedFileName, setSelectedFileName] = createSignal<string>();
    let inputRef: HTMLInputElement | undefined;

    const fileName = () => props.displayFileName ?? selectedFileName() ?? "";

    createEffect(() => {
        if (!fileName() && inputRef) {
            inputRef.value = "";
        }
    });

    const handleChange = (event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        setSelectedFileName(input.files?.[0]?.name);
        props.onChange(event);
    };

    const clearFile = () => {
        if (inputRef) {
            inputRef.value = "";
        }

        setSelectedFileName(undefined);
        props.onClear?.();
    };

    return (
        <div class="rescue-file-input">
            <input
                {...inputProps}
                accept={rescueFileTypes}
                type="file"
                class="rescue-file-input-control"
                ref={(el) => {
                    inputRef = el;
                }}
                onChange={handleChange}
            />
            <label
                for={inputProps.id}
                class="rescue-file-input-area"
                aria-disabled={inputProps.disabled}>
                <Show
                    when={fileName()}
                    fallback={
                        <span class="rescue-file-input-title">
                            <IoKey size={14} />
                            {t("upload_rescue_key")}
                        </span>
                    }>
                    <span class="rescue-file-input-filename">{fileName()}</span>
                </Show>
            </label>
            <Show when={fileName()}>
                <button
                    type="button"
                    class="rescue-file-input-clear"
                    data-testid="rescueFileInputClear"
                    disabled={inputProps.disabled}
                    onClick={clearFile}>
                    <IoClose />
                </button>
            </Show>
        </div>
    );
};

export default RescueFileInput;
