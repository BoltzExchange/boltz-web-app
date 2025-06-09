import { VsChevronDown, VsChevronRight } from "solid-icons/vs";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

const Accordion = (props: {
    title: string;
    children: JSX.Element;
    isOpen: boolean;
    onClick?: () => void;
}) => {
    return (
        <div class="accordion">
            <button
                class="accordion-header"
                style={{
                    cursor: props.onClick ? "pointer" : "default",
                }}
                onClick={() => props.onClick?.()}
                aria-expanded={props.isOpen}>
                <Show when={props.onClick}>
                    <span class="accordion-icon">
                        {props.isOpen ? <VsChevronDown /> : <VsChevronRight />}
                    </span>
                </Show>
                <span>{props.title}</span>
            </button>

            <Show when={props.isOpen}>
                <div class="accordion-content">{props.children}</div>
            </Show>
        </div>
    );
};

export default Accordion;
