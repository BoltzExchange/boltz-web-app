import { NetworkTransport } from "boltz-swaps/types";
import log from "loglevel";
import { type Accessor, type JSX, Show, createSignal } from "solid-js";

import { getNetworkTransport } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { type Signer, useWeb3Signer } from "../context/Web3";
import { formatError } from "../utils/errors";
import { createSignerNetworkCheck } from "../utils/signerNetwork";
import ConnectWallet, { ConnectAddress, SwitchNetwork } from "./ConnectWallet";
import LoadingSpinner from "./LoadingSpinner";
import SignerNetworkGuard from "./SignerNetworkGuard";

const ContractTransaction = (props: {
    asset: string;
    disabled?: boolean;
    signerOverride?: Accessor<Signer | undefined>;
    onClick: () => Promise<unknown>;
    children?: JSX.Element;
    showHr?: boolean;
    buttonText: string;
    promptText?: string;
    waitingText?: string;
    address?: { address: string; derivationPath?: string };
}) => {
    const { notify, i18n, t } = useGlobalContext();
    const { signer: contextSigner, connectedWallet } = useWeb3Signer();
    const [txSent, setTxSent] = createSignal(false);
    const [clicked, setClicked] = createSignal(false);

    const signer = () =>
        props.signerOverride !== undefined
            ? props.signerOverride()
            : contextSigner();
    const walletAddress = () => signer()?.address ?? connectedWallet()?.address;
    const walletTransport = () =>
        signer() !== undefined
            ? NetworkTransport.Evm
            : connectedWallet()?.transport;
    const expectedTransport = () => getNetworkTransport(props.asset);

    const signerNetwork = createSignerNetworkCheck(signer, () => props.asset);

    const allowAnyAddress = () =>
        props.address === undefined || props.address.address === undefined;

    return (
        <Show
            when={
                walletAddress() !== undefined &&
                walletTransport() === expectedTransport() &&
                (allowAnyAddress() ||
                    props.address?.address?.toLowerCase() ===
                        walletAddress()?.toLowerCase())
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
                        address={props.address!}
                    />
                </Show>
            }>
            <SignerNetworkGuard network={signerNetwork}>
                <Show
                    when={signerNetwork.valid()}
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
                                    log.error(`Transaction failed`, e);
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
            </SignerNetworkGuard>
        </Show>
    );
};

export default ContractTransaction;
