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

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { EIP6963ProviderInfo, useWeb3Signer } from "../context/Web3";
import "../style/web3.scss";
import { formatError } from "../utils/errors";
import { cropString, isMobile } from "../utils/helper";

const connect = async (
    notify: (type: string, message: string) => void,
    connectProvider: (rdns: string) => Promise<void>,
    provider: EIP6963ProviderInfo,
) => {
    try {
        await connectProvider(provider.rdns);
    } catch (e) {
        log.error(
            `Provider connect to ${provider.rdns} failed: ${formatError(e)}`,
        );
        notify("error", `Wallet connection failed: ${formatError(e)}`);
    }
};

const Modal = ({
    show,
    setShow,
}: {
    show: Accessor<boolean>;
    setShow: Setter<boolean>;
}) => {
    const { t, notify } = useGlobalContext();
    const { providers, connectProvider } = useWeb3Signer();

    const Provider = ({ provider }: { provider: EIP6963ProviderInfo }) => {
        return (
            <div
                class="provider-modal-entry-wrapper"
                onClick={() => connect(notify, connectProvider, provider)}>
                <hr />
                <div class="provider-modal-entry">
                    <img
                        class="provider-modal-icon"
                        src={provider.icon}
                        alt={`${provider.name} icon`}
                    />
                    <h4>{provider.name}</h4>
                </div>
            </div>
        );
    };

    return (
        <div
            id="settings-menu"
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
}: {
    address: Accessor<string | undefined>;
}) => {
    const { t } = useGlobalContext();
    const { clearSigner } = useWeb3Signer();

    const formatAddress = (addr: string) => {
        if (isMobile()) {
            return cropString(addr);
        }

        return addr;
    };

    const [text, setText] = createSignal<string>(formatAddress(address()));

    return (
        <button
            onClick={() => clearSigner()}
            onMouseEnter={() => setText(t("disconnect_address"))}
            onMouseLeave={() => setText(formatAddress(address()))}
            class="btn btn-light">
            {text()}
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

const ConnectWallet = () => {
    const { t } = useGlobalContext();
    const { providers, signer } = useWeb3Signer();
    const { setAddressValid, setOnchainAddress } = useCreateContext();

    const address = createMemo(() => signer()?.address);

    createEffect(() => {
        const addr = address();
        setAddressValid(addr !== undefined);
        setOnchainAddress(addr || "");
    });

    // TODO: check network
    return (
        <Show
            when={Object.keys(providers()).length > 0}
            fallback={
                <button class="btn" disabled>
                    {t("no_wallet")}
                </button>
            }>
            <Show when={address() !== undefined} fallback={<ConnectModal />}>
                <ShowAddress address={address} />
            </Show>
        </Show>
    );
};

export default ConnectWallet;
