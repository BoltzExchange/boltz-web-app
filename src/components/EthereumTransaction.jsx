import { Show, createSignal } from "solid-js";

import LoadingSpinner from "./LoadingSpinner.jsx";

const EthereumTransaction = ({
    onClick,
    promptText,
    buttonText,
    waitingText,
    showHr,
}) => {
    const [txSent, setTxSent] = createSignal(false);

    return (
        <>
            <Show when={!txSent()}>
                <p>{promptText}</p>
                <button
                    class="btn"
                    onClick={async () => {
                        await onClick();
                        setTxSent(true);
                    }}>
                    {buttonText}
                </button>
                <Show when={showHr}>
                    <hr />
                </Show>
            </Show>

            <Show when={txSent()}>
                <p>{waitingText}</p>
                <LoadingSpinner />
                <hr />
            </Show>
        </>
    );
};

export default EthereumTransaction;
