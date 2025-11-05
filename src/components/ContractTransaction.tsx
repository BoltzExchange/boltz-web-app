import log from "loglevel";
import type { JSX } from "solid-js";
import { Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { formatError } from "../utils/errors";
import ConnectWallet, { ConnectAddress, SwitchNetwork } from "./ConnectWallet";
import LoadingSpinner from "./LoadingSpinner";

const ContractTransaction = (props: {
    disabled?: boolean;
    onClick: () => Promise<unknown>;
    children?: JSX.Element;
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

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        const network = await signer()?.provider?.getNetwork();
        setSignerNetwork(Number(network?.chainId));
    });

    const allowAnyAddress = () =>
        props.address === undefined || props.address.address === undefined;

    return (
        <Show
            when={
                signer() !== undefined &&
                (allowAnyAddress() ||
                    props.address.address === signer().address)
            }
            fallback={
                <Show
                    when={!allowAnyAddress()}
                    fallback={
                        <ConnectWallet
                            derivationPath={props.address.derivationPath}
                        />
                    }>
                    <ConnectAddress address={props.address} />
                </Show>
            }>
            <Show
                when={getContracts().network.chainId === signerNetwork()}
                fallback={<SwitchNetwork />}>
                <Show
                    when={!txSent()}
                    fallback={
                        <>
                            <Show when={props.waitingText}>
                                <p>{props.waitingText}</p>
                            </Show>
                            <LoadingSpinner />
                        </>
                    }>
                    <Show when={props.promptText}>
                        <p>{props.promptText}</p>
                    </Show>
                    <Show when={props.children !== undefined}>
                        {props.children}
                    </Show>
                    <button
                        class="btn"
                        disabled={props.disabled || clicked()}
                        onClick={async () => {
                            setClicked(true);
                            try {
                                await props.onClick();
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
                        {props.buttonText}
                    </button>
                    <Show when={props.showHr}>
                        <hr />
                    </Show>
                </Show>
            </Show>
        </Show>
    );
};

export default ContractTransaction;
