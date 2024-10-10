import log from "loglevel";
import { IoClose } from "solid-icons/io";
import {
    Accessor,
    For,
    Setter,
    Show,
    createEffect,
    createMemo,
    createSignal,
} from "solid-js";

import type { EIP6963ProviderInfo } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import "../style/web3.scss";
import { formatError } from "../utils/errors";
import { cropString, isMobile } from "../utils/helper";
import HardwareDerivationPaths, { connect } from "./HardwareDerivationPaths";

const Modal = ({
    show,
    setShow,
}: {
    show: Accessor<boolean>;
    setShow: Setter<boolean>;
}) => {
    const { t, notify } = useGlobalContext();
    const { providers, connectProvider } = useWeb3Signer();

    const [showDerivationPaths, setShowDerivationPaths] =
        createSignal<boolean>(false);
    const [hardwareProvider, setHardwareProvider] =
        createSignal<EIP6963ProviderInfo>(undefined);

    const Provider = ({ provider }: { provider: EIP6963ProviderInfo }) => {
        return (
            <div
                class="provider-modal-entry-wrapper"
                onClick={async () => {
                    if (provider.disabled) {
                        return;
                    }

                    if (provider.isHardware) {
                        setHardwareProvider(provider);
                        setShowDerivationPaths(true);
                        return;
                    }

                    await connect(notify, connectProvider, provider);
                }}>
                <hr />
                <div
                    class="provider-modal-entry"
                    data-disabled={provider.disabled}
                    title={
                        provider.disabled
                            ? t("not_supported_in_browser")
                            : undefined
                    }>
                    <Show when={provider.icon !== undefined}>
                        <img
                            class="provider-modal-icon"
                            src={provider.icon}
                            alt={`${provider.name} icon`}
                        />
                    </Show>

                    <h4>{provider.name}</h4>
                </div>
            </div>
        );
    };

    return (
        <div
            class="frame assets-select"
            onClick={() => setShow(false)}
            style={show() ? "display: block;" : "display: none;"}>
            <div onClick={(e) => e.stopPropagation()}>
                <h2>{t("select_wallet")}</h2>
                <span class="close" onClick={() => setShow(false)}>
                    <IoClose />
                </span>
                <hr class="spacer" />
                <For
                    each={Object.values(providers()).sort((a, b) =>
                        a.info.name
                            .toLowerCase()
                            .localeCompare(b.info.name.toLowerCase()),
                    )}>
                    {(item) => <Provider provider={item.info} />}
                </For>
            </div>
            <HardwareDerivationPaths
                show={showDerivationPaths}
                provider={hardwareProvider}
                setShow={setShowDerivationPaths}
            />
        </div>
    );
};

const ConnectModal = () => {
    const { t, notify } = useGlobalContext();
    const { providers, connectProvider } = useWeb3Signer();

    const [show, setShow] = createSignal<boolean>(false);

    return (
        <>
            <button
                class="btn"
                onClick={() => {
                    if (Object.keys(providers()).length > 1) {
                        setShow(true);
                    } else {
                        // Do not show the modal when there is only one option to select
                        connect(
                            notify,
                            connectProvider,
                            Object.values(providers())[0].info,
                        ).then();
                    }
                }}>
                {t("connect_wallet")}
            </button>
            <Modal show={show} setShow={setShow} />
        </>
    );
};

const ShowAddress = ({
    address,
    addressOverride,
}: {
    address: Accessor<string | undefined>;
    addressOverride?: Accessor<string | undefined>;
}) => {
    const { t } = useGlobalContext();
    const { clearSigner } = useWeb3Signer();

    const formatAddress = (addr: string) => {
        if (isMobile()) {
            return cropString(addr);
        }

        return addr;
    };

    const [text, setText] = createSignal<string | undefined>(undefined);

    return (
        <button
            onClick={() => clearSigner()}
            onMouseEnter={() => setText(t("disconnect_address"))}
            onMouseLeave={() => setText(undefined)}
            class="btn btn-light">
            {text() ||
                (addressOverride
                    ? addressOverride() || formatAddress(address())
                    : formatAddress(address()))}
        </button>
    );
};

export const ConnectAddress = ({ address }: { address: string }) => {
    const { t, notify } = useGlobalContext();
    const { connectProviderForAddress } = useWeb3Signer();

    return (
        <button
            class="btn"
            onClick={async () => {
                try {
                    await connectProviderForAddress(address);
                } catch (e) {
                    log.error(
                        `Provider connect for address ${address} failed: ${formatError(e)}`,
                    );
                    notify(
                        "error",
                        `Wallet connection failed: ${formatError(e)}`,
                    );
                }
            }}>
            {t("connect_to_address")}
        </button>
    );
};

export const SwitchNetwork = () => {
    const { t, notify } = useGlobalContext();
    const { switchNetwork } = useWeb3Signer();

    return (
        <button
            class="btn"
            onClick={async () => {
                try {
                    await switchNetwork();
                } catch (e) {
                    log.error(`Network switch failed: ${formatError(e)}`);
                    notify("error", `Network switch failed: ${formatError(e)}`);
                }
            }}>
            {t("switch_network")}
        </button>
    );
};

const ConnectWallet = ({
    addressOverride,
}: {
    addressOverride?: Accessor<string | undefined>;
}) => {
    const { t } = useGlobalContext();
    const { providers, signer, getContracts } = useWeb3Signer();
    const { setAddressValid, setOnchainAddress } = useCreateContext();

    const address = createMemo(() => signer()?.address);
    const [networkValid, setNetworkValid] = createSignal<boolean>(true);

    createEffect(async () => {
        if (
            address() !== undefined &&
            Number((await signer()?.provider.getNetwork()).chainId) !==
                getContracts().network.chainId
        ) {
            setNetworkValid(false);
            return;
        }

        setNetworkValid(true);

        const addr = address();
        setAddressValid(addr !== undefined);
        setOnchainAddress(addr || "");
    });

    return (
        <Show
            when={Object.keys(providers()).length > 0}
            fallback={
                <button class="btn" disabled>
                    {t("no_wallet")}
                </button>
            }>
            <Show when={address() !== undefined} fallback={<ConnectModal />}>
                <Show when={networkValid()} fallback={<SwitchNetwork />}>
                    <ShowAddress
                        address={address}
                        addressOverride={addressOverride}
                    />
                </Show>
            </Show>
        </Show>
    );
};

export default ConnectWallet;
