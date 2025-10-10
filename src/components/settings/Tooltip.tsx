import { type JSX, createMemo } from "solid-js";

import { useGlobalContext } from "../../context/Global";
import type { DictKey } from "../../i18n/i18n";
import "../../style/tooltip.scss";

type Direction = "left" | "right" | "top" | "bottom";

const Tooltip = (props: {
    label: { key: DictKey; variables?: Record<string, string> };
    children: JSX.Element;
    direction?: Direction[];
    pxDistance?: number;
}) => {
    const timeout_delay = 300;
    const timeout_delay_click = 2500;

    const { t } = useGlobalContext();

    let timeout: ReturnType<typeof setTimeout> = null;

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

    const getTooltipPosition = createMemo(() => {
        const oppositePosition = {
            left: "right",
            right: "left",
            top: "bottom",
            bottom: "top",
        };

        const directions = props.direction || ["right"];
        const offset = props.pxDistance ? `${props.pxDistance}px` : "30px";

        return directions.reduce(
            (acc, direction) => {
                const opposite = oppositePosition[direction];
                if (opposite) {
                    acc[opposite] = offset;
                }
                return acc;
            },
            {} as Record<string, string>,
        );
    });

    return (
        <span class="tooltip">
            <span
                onClick={tooltipClick}
                onMouseEnter={tooltipEnter}
                onMouseLeave={tooltipLeave}>
                {props.children}
            </span>
            <span
                class={`tooltip-text ${props.direction?.join(" ") || "right"}`}
                style={getTooltipPosition()}>
                {t(props.label.key, props.label.variables)}
            </span>
        </span>
    );
};

export default Tooltip;
