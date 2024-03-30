import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import { Show, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { clipboard } from "../utils/helper";

const CopyButton = ({ data, label }) => {
    const { t } = useGlobalContext();
    const [buttonClass, setButtonClass] = createSignal<string>("btn");
    const [buttonActive, setButtonActive] = createSignal<boolean>(false);
    const onClick = () => {
        clipboard(data.replaceAll(" ", ""));
        setButtonClass("btn btn-active");
        setButtonActive(true);
        setTimeout(() => {
            setButtonClass("btn");
            setButtonActive(false);
        }, 600);
    };

    return (
        <span class={buttonClass()} onClick={onClick}>
            <Show
                when={buttonActive() === true}
                fallback=<BiRegularCopy size={21} />>
                <IoCheckmark size={21} />
            </Show>
            {t(label)}
        </span>
    );
};

export default CopyButton;
