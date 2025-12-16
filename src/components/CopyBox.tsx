import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import { For, Show, createSignal } from "solid-js";
import { isInvoice } from "src/utils/invoice";

import { copyIconTimeout } from "../consts/CopyContent";
import {
    clipboard,
    cropString,
    formatAddress,
    isMobile,
} from "../utils/helper";

const CopyBox = (props: { value: string; groupSize?: number }) => {
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

    const renderAddress = () => {
        const groups = formatAddress(props.value, props.groupSize);
        return (
            <span>
                <For each={groups}>
                    {(group, index) => (
                        <>
                            <span
                                class={
                                    index() < 2 || index() >= groups.length - 2
                                        ? "address-highlight"
                                        : "address-normal"
                                }>
                                {group}
                            </span>
                            {index() < groups.length - 1 && " "}
                        </>
                    )}
                </For>
            </span>
        );
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
            {isInvoice(props.value)
                ? cropString(props.value, baseStrLength, maxStrLength)
                : renderAddress()}
        </p>
    );
};

export default CopyBox;
