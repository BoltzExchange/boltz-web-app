import { formatAmount } from "../utils/denomination";
import { Show } from "solid-js";

const ClickableAmount = ({ label, onClick, amount }) => {
    return (
        <>
            <Show when={label !== undefined}>{label}: </Show>
            <span onClick={() => onClick(amount())} class="btn-small btn-light">
                {formatAmount(amount())}
            </span>
        </>
    );
};

export default ClickableAmount;
