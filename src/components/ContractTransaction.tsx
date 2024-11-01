import log from "loglevel";
import { Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { formatError } from "../utils/errors";
import ConnectWallet, { ConnectAddress, SwitchNetwork } from "./ConnectWallet";
import LoadingSpinner from "./LoadingSpinner";

const ContractTransaction = ({
    showHr,
    onClick,
    address,
    children,
    promptText,
    buttonText,
    waitingText,
}: {
    onClick: () => Promise<any>;
    children?: any;
    showHr?: boolean;
    buttonText: string;
    promptText?: string;
    waitingText?: string;
    address: { address: string; derivationPath?: string };
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

    const allowAnyAddress =
        address === undefined || address.address === undefined;

    return (
        <Show
            when={
                signer() !== undefined &&
                (allowAnyAddress || address.address === signer().address)
            }
            fallback={
                <Show
                    when={!allowAnyAddress}
                    fallback={
                        <ConnectWallet
                            derivationPath={address.derivationPath}
                        />
                    }>
                    <ConnectAddress address={address} />
                </Show>
            }>
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
                    <Show when={children !== undefined}>{children}</Show>
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
