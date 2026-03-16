import log from "loglevel";
import { IoClose } from "solid-icons/io";
import type { Accessor, Setter } from "solid-js";
import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { config } from "../config";
import { isEvmAsset } from "../consts/Assets";
import type { EIP6963ProviderInfo } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { type Signer, useWeb3Signer } from "../context/Web3";
import "../style/web3.scss";
import { formatError } from "../utils/errors";
import { cropString, isMobile } from "../utils/helper";
import HardwareDerivationPaths, { connect } from "./HardwareDerivationPaths";
import { hiddenInformation } from "./settings/PrivacyMode";

const Modal = (props: {
    asset: string;
    derivationPath: string;
    show: Accessor<boolean>;
    setShow: Setter<boolean>;
}) => {
    const { t, notify } = useGlobalContext();
    const { providers, connectProvider, hasBrowserWallet, setWalletConnected } =
        useWeb3Signer();

    const [showDerivationPaths, setShowDerivationPaths] =
        createSignal<boolean>(false);
    const [hardwareProvider, setHardwareProvider] =
        createSignal<EIP6963ProviderInfo>(undefined);

    const Provider = (providerProps: { provider: EIP6963ProviderInfo }) => {
        return (
            <div
                class="provider-modal-entry-wrapper"
                onClick={async () => {
                    if (providerProps.provider.disabled) {
                        notify("error", t("not_supported_in_browser"));
                        return;
                    }

                    if (providerProps.provider.isHardware) {
                        setHardwareProvider(providerProps.provider);
                        setShowDerivationPaths(true);
                        return;
                    }

                    const connected = await connect(
                        notify,
                        connectProvider,
                        providerProps.provider,
                        props.derivationPath,
                        props.asset,
                    );
                    setWalletConnected(connected);
                }}>
                <hr />
                <div
                    class="provider-modal-entry"
                    data-disabled={providerProps.provider.disabled}
                    title={
                        providerProps.provider.disabled
                            ? t("not_supported_in_browser")
                            : undefined
                    }>
                    <Show when={providerProps.provider.icon !== undefined}>
                        <img
                            class="provider-modal-icon"
                            src={providerProps.provider.icon}
                            alt={`${providerProps.provider.name} icon`}
                        />
                    </Show>

                    <h4>{providerProps.provider.name}</h4>
                </div>
            </div>
        );
    };

    return (
        <div
            data-testid="wallet-connect-modal"
            class="frame assets-select"
            onClick={() => props.setShow(false)}
            style={props.show() ? "display: block;" : "display: none;"}>
            <div onClick={(e) => e.stopPropagation()}>
                <h2>{t("select_wallet")}</h2>
                <span class="close" onClick={() => props.setShow(false)}>
                    <IoClose />
                </span>
                <hr class="spacer" />
                <Show when={!hasBrowserWallet()}>
                    <hr />

                    <div class="no-browser-wallet">
                        <h3>{t("no_browser_wallet")}</h3>
                    </div>
                    <hr class="spacer" />
                </Show>
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
                asset={props.asset}
                show={showDerivationPaths}
                provider={hardwareProvider}
                setShow={setShowDerivationPaths}
            />
        </div>
    );
};

const ConnectModal = (props: {
    asset: string;
    derivationPath: string;
    disabled?: Accessor<boolean>;
}) => {
    const { t, notify } = useGlobalContext();
    const { providers, connectProvider, setWalletConnected } = useWeb3Signer();

    const [show, setShow] = createSignal<boolean>(false);

    return (
        <>
            <button
                class="btn"
                disabled={
                    props.disabled !== undefined ? props.disabled() : false
                }
                onClick={async () => {
                    if (Object.keys(providers()).length > 1) {
                        setShow(true);
                    } else {
                        // Do not show the modal when there is only one option to select
                        const connected = await connect(
                            notify,
                            connectProvider,
                            Object.values(providers())[0].info,
                            props.derivationPath,
                            props.asset,
                        );
                        setWalletConnected(connected);
                    }
                }}>
                {t("connect_wallet")}
            </button>
            <Modal
                asset={props.asset}
                show={show}
                setShow={setShow}
                derivationPath={props.derivationPath}
            />
        </>
    );
};

const ShowAddress = (props: {
    address: Accessor<string | undefined>;
    addressOverride?: Accessor<string | undefined>;
}) => {
    const { t, privacyMode } = useGlobalContext();
    const { clearSigner } = useWeb3Signer();

    const formatAddress = (addr: string) => {
        if (privacyMode()) {
            return hiddenInformation;
        }

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
                (props.addressOverride
                    ? props.addressOverride() || formatAddress(props.address())
                    : formatAddress(props.address()))}
        </button>
    );
};

export const ConnectAddress = (props: {
    asset: string;
    address: { address: string; derivationPath?: string };
}) => {
    const { t, notify } = useGlobalContext();
    const { connectProviderForAddress } = useWeb3Signer();

    return (
        <button
            class="btn"
            onClick={async () => {
                try {
                    await connectProviderForAddress(
                        props.address.address,
                        props.address.derivationPath,
                        props.asset,
                    );
                } catch (e) {
                    log.error(
                        `Provider connect for address ${props.address.address} failed: ${formatError(e)}`,
                    );
                    notify(
                        "error",
                        t("wallet_connect_failed", { error: formatError(e) }),
                    );
                }
            }}>
            {t("connect_to_address")}
        </button>
    );
};

export const SwitchNetwork = (props: { asset: string }) => {
    const { t, notify } = useGlobalContext();
    const { switchNetwork } = useWeb3Signer();

    return (
        <button
            class="btn"
            onClick={async () => {
                try {
                    await switchNetwork(props.asset);
                } catch (e) {
                    log.error(`Network switch failed: ${formatError(e)}`);
                    notify("error", `Network switch failed: ${formatError(e)}`);
                }
            }}>
            {t("switch_network")}
        </button>
    );
};

const ConnectWallet = (props: {
    asset: string;
    derivationPath?: string;
    disabled?: Accessor<boolean>;
    addressOverride?: Accessor<string | undefined>;
    syncAddress?: boolean;
}) => {
    const { t } = useGlobalContext();
    const { providers, signer } = useWeb3Signer();
    const { setAddressValid, setOnchainAddress } = useCreateContext();

    const address = () => signer()?.address;
    const [networkValid, setNetworkValid] = createSignal<boolean>(true);
    let latestSyncId = 0;

    const syncWalletState = async (
        asset: string,
        activeSigner: Signer | undefined,
        currentAddress: string | undefined,
        syncId: number,
    ) => {
        const chainId = config.assets?.[asset]?.network?.chainId;
        const signerChainId =
            currentAddress !== undefined && chainId !== undefined
                ? Number(
                      (await activeSigner?.provider.getNetwork())?.chainId ||
                          -1,
                  )
                : undefined;

        if (syncId !== latestSyncId) {
            return;
        }

        if (
            currentAddress !== undefined &&
            chainId !== undefined &&
            signerChainId !== chainId
        ) {
            setNetworkValid(false);
            return;
        }

        setNetworkValid(true);

        if (isEvmAsset(asset) && props.syncAddress) {
            setAddressValid(currentAddress !== undefined);
            setOnchainAddress(currentAddress || "");
            return;
        }
    };

    createEffect(
        on(
            [() => props.asset, signer, address],
            ([asset, activeSigner, addr]) => {
                const syncId = ++latestSyncId;
                void syncWalletState(asset, activeSigner, addr, syncId);
            },
        ),
    );

    onCleanup(() => {
        if (props.syncAddress) {
            setAddressValid(false);
            setOnchainAddress("");
        }
    });

    return (
        <Show
            when={Object.keys(providers()).length > 0}
            fallback={
                <button class="btn" disabled>
                    {t("no_wallet")}
                </button>
            }>
            <Show
                when={address() !== undefined}
                fallback={
                    <ConnectModal
                        asset={props.asset}
                        disabled={props.disabled}
                        derivationPath={props.derivationPath}
                    />
                }>
                <Show
                    when={networkValid()}
                    fallback={<SwitchNetwork asset={props.asset} />}>
                    <ShowAddress
                        address={address}
                        addressOverride={props.addressOverride}
                    />
                </Show>
            </Show>
        </Show>
    );
};

export default ConnectWallet;
