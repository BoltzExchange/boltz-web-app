import log from "loglevel";
import { Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { formatError } from "../utils/errors";
import { ConnectAddress, SwitchNetwork } from "./ConnectWallet";
import LoadingSpinner from "./LoadingSpinner";

const ContractTransaction = ({
    showHr,
    onClick,
    address,
    promptText,
    buttonText,
    waitingText,
}: {
    onClick: () => Promise<any>;
    address: string;
    buttonText: string;
    promptText?: string;
    showHr?: boolean;
    waitingText?: string;
}) => {
    const { notify } = useGlobalContext();
    const { signer, getContracts } = useWeb3Signer();
    const [txSent, setTxSent] = createSignal(false);
    const [clicked, setClicked] = createSignal(false);

    const [signerNetwork, setSignerNetwork] = createSignal<number | undefined>(
        undefined,
    );

    createEffect(async () => {
        const network = await signer()?.provider?.getNetwork();
        setSignerNetwork(Number(network?.chainId));
    });

    return (
        <Show
            when={signer() !== undefined && address === signer().address}
            fallback={<ConnectAddress address={address} />}>
            <Show
                when={getContracts().network.chainId === signerNetwork()}
                fallback={<SwitchNetwork />}>
                <Show
                    when={!txSent()}
                    fallback={
                        <>
                            <Show when={waitingText}>
                                <p>{waitingText}</p>
                            </Show>
                            <LoadingSpinner />
                        </>
                    }>
                    <Show when={promptText}>
                        <p>{promptText}</p>
                    </Show>
                    <button
                        class="btn"
                        disabled={clicked()}
                        onClick={async () => {
                            setClicked(true);
                            try {
                                await onClick();
                                setTxSent(true);
                            } catch (e) {
                                log.error(`EVM transaction failed`, e);
                                notify(
                                    "error",
                                    `Transaction failed: ${formatError(e)}`,
                                );
                            } finally {
                                setClicked(false);
                            }
                        }}>
                        {buttonText}
                    </button>
                    <Show when={showHr}>
                        <hr />
                    </Show>
                </Show>
            </Show>
        </Show>
    );
};

export default ContractTransaction;
