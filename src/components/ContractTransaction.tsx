import type { Wallet } from "ethers";
import log from "loglevel";
import type { Accessor, JSX } from "solid-js";
import { Show, createEffect, createSignal } from "solid-js";

import { config } from "../config";
import { useGlobalContext } from "../context/Global";
import { type Signer, useWeb3Signer } from "../context/Web3";
import { formatError } from "../utils/errors";
import ConnectWallet, { ConnectAddress, SwitchNetwork } from "./ConnectWallet";
import LoadingSpinner from "./LoadingSpinner";

const ContractTransaction = (props: {
    asset: string;
    disabled?: boolean;
    signerOverride?: Accessor<Signer | Wallet>;
    onClick: () => Promise<unknown>;
    children?: JSX.Element;
    showHr?: boolean;
    buttonText: string;
    promptText?: string;
    waitingText?: string;
    address?: { address: string; derivationPath?: string };
}) => {
    const { notify, i18n, t } = useGlobalContext();
    const { signer: contextSigner } = useWeb3Signer();
    const [txSent, setTxSent] = createSignal(false);
    const [clicked, setClicked] = createSignal(false);

    const signer = () =>
        props.signerOverride !== undefined
            ? props.signerOverride()
            : contextSigner();

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
                    props.address?.address === signer().address)
            }
            fallback={
                <Show
                    when={!allowAnyAddress()}
                    fallback={
                        <ConnectWallet
                            asset={props.asset}
                            derivationPath={props.address?.derivationPath}
                        />
                    }>
                    <ConnectAddress
                        asset={props.asset}
                        address={props.address}
                    />
                </Show>
            }>
            <Show
                when={
                    config.assets?.[props.asset]?.network?.chainId ===
                    signerNetwork()
                }
                fallback={<SwitchNetwork asset={props.asset} />}>
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
                                    t("transaction_failed", {
                                        error: formatError(e, i18n()),
                                    }),
                                );
                            } finally {
                                setClicked(false);
                            }
                        }}>
                        {clicked() ? (
                            <LoadingSpinner class="inner-spinner" />
                        ) : (
                            props.buttonText
                        )}
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
