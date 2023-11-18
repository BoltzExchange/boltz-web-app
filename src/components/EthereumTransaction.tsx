import { Show, createSignal } from "solid-js";

import LoadingSpinner from "./LoadingSpinner";

const EthereumTransaction = ({
    onClick,
    promptText,
    buttonText,
    waitingText,
    showHr,
}: {
    onClick: () => Promise<any>;
    buttonText: string;
    waitingText?: string;
    showHr?: boolean;
    promptText?: string;
}) => {
    const [txSent, setTxSent] = createSignal(false);

    return (
        <>
            <Show when={!txSent()}>
                <Show when={promptText}>
                    <p>{promptText}</p>
                </Show>
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
                <Show when={waitingText}>
                    <p>{waitingText}</p>
                </Show>
                <LoadingSpinner />
                <hr />
            </Show>
        </>
    );
};

export default EthereumTransaction;
