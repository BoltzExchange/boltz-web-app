import BigNumber from "bignumber.js";
import log from "loglevel";
import { IoClose } from "solid-icons/io";
import type { Accessor, Setter } from "solid-js";
import {
    For,
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import { RBTC } from "../consts/Assets";
import type { EIP6963ProviderInfo } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import "../style/web3.scss";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { cropString, isMobile } from "../utils/helper";
import { weiToSatoshi } from "../utils/rootstock";
import HardwareDerivationPaths, { connect } from "./HardwareDerivationPaths";
import { getSpendableBalance } from "./LockupEvm";
import { WalletConnect } from "./WalletConnect";

const Modal = (props: {
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
                        providers,
                        providerProps.provider,
                        props.derivationPath,
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
                show={showDerivationPaths}
                provider={hardwareProvider}
                setShow={setShowDerivationPaths}
            />
        </div>
    );
};

const ConnectModal = (props: {
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
                            providers,
                            Object.values(providers())[0].info,
                            props.derivationPath,
                        );
                        setWalletConnected(connected);
                    }
                }}>
                {t("connect_wallet")}
            </button>
            <Modal
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
    const { t, separator, denomination } = useGlobalContext();
    const { signer, clearSigner } = useWeb3Signer();

    const formatAddress = (addr: string) => {
        if (isMobile()) {
            return cropString(addr);
        }

        return addr;
    };

    const [text, setText] = createSignal<string | undefined>(undefined);

    const [spendableBalance] = createResource(
        async () => await getSpendableBalance(signer),
    );

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
            <Show
                when={
                    spendableBalance.state === "ready" &&
                    typeof spendableBalance() === "bigint"
                }>
                <br />
                {t("balance")}:{" "}
                {formatAmount(
                    BigNumber(weiToSatoshi(spendableBalance()).toString()),
                    denomination(),
                    separator(),
                )}{" "}
                {formatDenomination(denomination(), RBTC)}
            </Show>
        </button>
    );
};

export const ConnectAddress = (props: {
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
            <WalletConnect />
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

const ConnectWallet = (props: {
    derivationPath?: string;
    disabled?: Accessor<boolean>;
    addressOverride?: Accessor<string | undefined>;
}) => {
    const { t } = useGlobalContext();
    const { providers, signer, getContracts } = useWeb3Signer();
    const { setAddressValid, setOnchainAddress, assetReceive } =
        useCreateContext();

    const address = createMemo(() => signer()?.address);
    const [networkValid, setNetworkValid] = createSignal<boolean>(true);

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (
            address() !== undefined &&
            Number((await signer()?.provider.getNetwork())?.chainId || -1) !==
                getContracts().network.chainId
        ) {
            setNetworkValid(false);
            return;
        }

        setNetworkValid(true);

        if (assetReceive() === RBTC) {
            const addr = address();
            setAddressValid(addr !== undefined);
            setOnchainAddress(addr || "");
        }
    });

    onCleanup(() => {
        setAddressValid(false);
        setOnchainAddress("");
    });

    return (
        <Show
            when={Object.keys(providers()).length > 0}
            fallback={
                <button class="btn" disabled>
                    {t("no_wallet")}
                </button>
            }>
            <WalletConnect />
            <Show
                when={address() !== undefined}
                fallback={
                    <ConnectModal
                        disabled={props.disabled}
                        derivationPath={props.derivationPath}
                    />
                }>
                <Show when={networkValid()} fallback={<SwitchNetwork />}>
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
