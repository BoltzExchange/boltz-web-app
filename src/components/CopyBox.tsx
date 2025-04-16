import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import { Show, createSignal } from "solid-js";

import { copyIconTimeout } from "../consts/CopyContent";
import { clipboard, cropString, isMobile } from "../utils/helper";

const CopyBox = (props: { value: string }) => {
    const [copyBoxActive, setCopyBoxActive] = createSignal(false);
    const baseStrLength = isMobile() ? 8 : 13;
    const maxStrLength = baseStrLength + 3; // 3 is the length of the ellipsis

    const copyBoxText = () => {
        clipboard(props.value);
        setCopyBoxActive(true);
        setTimeout(() => {
            setCopyBoxActive(false);
        }, copyIconTimeout);
    };

    return (
        <p onClick={copyBoxText} class="copy-box break-word">
            <Show
                when={copyBoxActive()}
                fallback={<BiRegularCopy size={23} data-testid="copy-icon" />}>
                <IoCheckmark size={23} data-testid="checkmark-icon" />
            </Show>
            {cropString(props.value, baseStrLength, maxStrLength)}
        </p>
    );
};

export default CopyBox;
