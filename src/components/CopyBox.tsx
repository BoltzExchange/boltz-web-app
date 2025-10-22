import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import { Show, createSignal } from "solid-js";

import { copyIconTimeout } from "../consts/CopyContent";
import { clipboard, formatAddress } from "../utils/helper";

const CopyBox = (props: { value: string }) => {
    const [copyBoxActive, setCopyBoxActive] = createSignal(false);

    const copyBoxText = () => {
        clipboard(props.value);
        setCopyBoxActive(true);
        setTimeout(() => {
            setCopyBoxActive(false);
        }, copyIconTimeout);
    };

    return (
        <p
            onClick={copyBoxText}
            class="copy-box break-word"
            data-testid="copy-box">
            <Show
                when={copyBoxActive()}
                fallback={<BiRegularCopy size={23} data-testid="copy-icon" />}>
                <IoCheckmark size={23} data-testid="checkmark-icon" />
            </Show>
            {formatAddress(props.value)}
        </p>
    );
};

export default CopyBox;
