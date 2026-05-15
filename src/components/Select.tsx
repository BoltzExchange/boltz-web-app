import { For } from "solid-js";

type SelectProps = {
    value: string;
    options: readonly string[];
    onChange: (value: string) => void;
    labelFor?: (value: string) => string;
    title?: string;
    class?: string;
    "data-testid"?: string;
};

const Select = (props: SelectProps) => {
    return (
        <select
            class={`select${props.class ? ` ${props.class}` : ""}`}
            data-testid={props["data-testid"]}
            title={props.title}
            value={props.value}
            onChange={(e) => props.onChange(e.currentTarget.value)}>
            <For each={props.options}>
                {(option) => (
                    <option value={option}>
                        {props.labelFor ? props.labelFor(option) : option}
                    </option>
                )}
            </For>
        </select>
    );
};

export default Select;
