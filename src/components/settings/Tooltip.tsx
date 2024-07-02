import { BiSolidHelpCircle } from "solid-icons/bi";

import { useGlobalContext } from "../../context/Global";
import "../../style/tooltip.scss";

const Tooltip = ({ label }) => {
    const timeout_delay = 300;
    const timeout_delay_click = 2500;

    const { t } = useGlobalContext();

    let timeout: any = null;

    const tooltipClick = (evt: MouseEvent) => {
        const target = evt.currentTarget as HTMLSpanElement;
        (target.parentNode as HTMLSpanElement).classList.add("active");
        timeout = setTimeout(() => {
            (target.parentNode as HTMLSpanElement).classList.remove("active");
        }, timeout_delay_click);
    };

    const tooltipEnter = (evt: MouseEvent) => {
        if (timeout) clearTimeout(timeout);
        const target = evt.currentTarget as HTMLSpanElement;
        (target.parentNode as HTMLSpanElement).classList.add("active");
    };

    const tooltipLeave = (evt: MouseEvent) => {
        const target = evt.currentTarget as HTMLSpanElement;
        timeout = setTimeout(() => {
            (target.parentNode as HTMLSpanElement).classList.remove("active");
        }, timeout_delay);
    };

    return (
        <span class="tooltip">
            <span
                onClick={tooltipClick}
                onMouseEnter={tooltipEnter}
                onMouseLeave={tooltipLeave}>
                <BiSolidHelpCircle />
            </span>
            <span class="tooltip-text">{t(label)}</span>
        </span>
    );
};

export default Tooltip;
