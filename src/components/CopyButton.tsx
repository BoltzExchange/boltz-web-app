import { BiRegularCopy } from "solid-icons/bi";
import { IoCheckmark } from "solid-icons/io";
import { Show, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { clipboard } from "../utils/helper";

const CopyButton = ({
    data,
    label,
    btnClass = "btn",
}: {
    data: string;
    label: string;
    btnClass?: string;
}) => {
    const { t } = useGlobalContext();

    const [buttonClass, setButtonClass] = createSignal<string>(btnClass);
    const [buttonActive, setButtonActive] = createSignal<boolean>(false);

    const onClick = () => {
        clipboard(data.replaceAll(" ", ""));
        setButtonClass(`${btnClass} btn-active`);
        setButtonActive(true);
        setTimeout(() => {
            setButtonClass(btnClass);
            setButtonActive(false);
        }, 600);
    };

    return (
        <span class={buttonClass()} onClick={onClick}>
            <Show
                when={buttonActive() === true}
                fallback={<BiRegularCopy size={21} />}>
                <IoCheckmark size={21} />
            </Show>
            {t(label)}
        </span>
    );
};

export default CopyButton;
