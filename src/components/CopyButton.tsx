import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import type { Accessor } from "solid-js";
import { Show, createEffect, createSignal, mergeProps } from "solid-js";

import { copyIconTimeout } from "../consts/CopyContent";
import { useGlobalContext } from "../context/Global";
import type { DictKey } from "../i18n/i18n";
import { clipboard } from "../utils/helper";

const CopyButton = (props: {
    label: DictKey;
    data: string | Accessor<string>;
    btnClass?: string;
}) => {
    const { t } = useGlobalContext();

    const merged = mergeProps({ btnClass: "btn" }, props);

    const [buttonClass, setButtonClass] = createSignal<string>("");
    const [buttonActive, setButtonActive] = createSignal<boolean>(false);

    createEffect(() => {
        setButtonClass(merged.btnClass);
    });

    const onClick = () => {
        const copyData =
            typeof merged.data === "string" ? merged.data : merged.data();
        clipboard(copyData.replaceAll(" ", ""));
        setButtonClass(`${merged.btnClass} btn-active`);
        setButtonActive(true);
        setTimeout(() => {
            setButtonClass(merged.btnClass);
            setButtonActive(false);
        }, copyIconTimeout);
    };

    return (
        <span class={buttonClass()} onClick={onClick}>
            <Show
                when={buttonActive() === true}
                fallback={<BiRegularCopy size={21} />}>
                <IoCheckmark size={21} />
            </Show>
            {t(merged.label)}
        </span>
    );
};

export default CopyButton;
