import { createSignal, Show } from "solid-js";
import LoadingSpinner from "./LoadingSpinner.jsx";

const EthereumTransaction = ({
    onClick,
    promptText,
    buttonText,
    waitingText,
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
                <hr />
            </Show>

            <Show when={txSent()}>
                <p>{waitingText}</p>
                <LoadingSpinner />
            </Show>
        </>
    );
};

export default EthereumTransaction;
