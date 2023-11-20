import { Show, createSignal } from "solid-js";

import LoadingSpinner from "./LoadingSpinner";

const ContractTransaction = ({
    showHr,
    onClick,
    promptText,
    buttonText,
    waitingText,
}: {
    onClick: () => Promise<any>;
    buttonText: string;
    promptText?: string;
    showHr?: boolean;
    waitingText?: string;
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

export default ContractTransaction;
