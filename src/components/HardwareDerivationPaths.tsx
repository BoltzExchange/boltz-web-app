import BigNumber from "bignumber.js";
import log from "loglevel";
import { ImArrowLeft2, ImArrowRight2 } from "solid-icons/im";
import { IoClose } from "solid-icons/io";
import type { Accessor, Setter } from "solid-js";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { Denomination } from "../consts/Enums";
import type {
    EIP6963ProviderDetail,
    EIP6963ProviderInfo,
} from "../consts/Types";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { formatAmount } from "../utils/denomination";
import { formatError } from "../utils/errors";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import {
    derivationPaths,
    derivationPathsMainnet,
    derivationPathsTestnet,
} from "../utils/hardware/HardwareSigner";
import { cropString } from "../utils/helper";
import { weiToSatoshi } from "../utils/rootstock";
import LoadingSpinner from "./LoadingSpinner";

export const connect = async (
    notify: (type: string, message: string) => void,
    connectProvider: (rdns: string) => Promise<void>,
    providers: Accessor<Record<string, EIP6963ProviderDetail>>,
    provider: EIP6963ProviderInfo,
    derivationPath?: string,
) => {
    try {
        if (derivationPath !== undefined) {
            const prov = providers()[provider.rdns]
                .provider as unknown as HardwareSigner;
            prov.setDerivationPath(derivationPath);
        }

        await connectProvider(provider.rdns);
        return true;
    } catch (e) {
        log.error(
            `Provider connect to ${provider.rdns} failed: ${formatError(e)}`,
        );
        notify("error", `Wallet connection failed: ${formatError(e)}`);
        return false;
    }
};

const connectHardware = async (
    notify: (type: string, message: string) => void,
    connectProvider: (rdns: string) => Promise<void>,
    provider: Accessor<EIP6963ProviderInfo>,
    providers: Accessor<Record<string, EIP6963ProviderDetail>>,
    path: string,
    setLoading: Setter<boolean>,
) => {
    try {
        setLoading(true);

        return await connect(
            notify,
            connectProvider,
            providers,
            provider(),
            path,
        );
    } finally {
        setLoading(false);
    }
};

const DerivationPath = (props: {
    name: string;
    path: string;
    setBasePath: Setter<string>;
}) => {
    return (
        <div
            class="provider-modal-entry-wrapper"
            onClick={() => {
                props.setBasePath(props.path);
            }}>
            <hr />
            <div class="provider-modal-entry">
                <h4 style={{ "white-space": "nowrap" }}>{props.name}</h4>
                <span>{props.path}</span>
            </div>
        </div>
    );
};

const HwAddressSelection = (props: {
    setLoading: Setter<boolean>;
    basePath: Accessor<string>;
    setBasePath: Setter<string>;
    provider: Accessor<EIP6963ProviderInfo>;
}) => {
    const limit = 5;

    const { separator, notify } = useGlobalContext();
    const { providers, connectProvider, setWalletConnected } = useWeb3Signer();

    const [offset, setOffset] = createSignal(0);
    const isFirstPage = () => offset() === 0;

    // eslint-disable-next-line solid/reactivity
    const [addresses] = createResource(offset, async () => {
        try {
            const prov = providers()[props.provider().rdns]
                .provider as unknown as HardwareSigner;

            const addresses = await prov.deriveAddresses(
                props.basePath(),
                offset(),
                limit,
            );
            return await Promise.all(
                addresses.map(async ({ address, path }) => ({
                    path,
                    address,
                    balance: await prov.getProvider().getBalance(address),
                })),
            );
        } catch (e) {
            props.setBasePath(undefined);
            log.error(`Deriving addresses failed: ${formatError(e)}`);
            notify("error", `Deriving addresses failed: ${formatError(e)}`);
            throw e;
        }
    });

    return (
        <Show when={!addresses.loading} fallback={<LoadingSpinner />}>
            <For each={addresses()}>
                {({ address, balance, path }) => (
                    <div
                        class="provider-modal-entry-wrapper"
                        onClick={async () => {
                            const connected = await connectHardware(
                                notify,
                                connectProvider,
                                props.provider,
                                providers,
                                path,
                                props.setLoading,
                            );
                            setWalletConnected(connected);
                        }}>
                        <hr />
                        <div
                            class="provider-modal-entry"
                            style={{ padding: "8px 10%" }}>
                            <h4 class="no-grow">
                                {cropString(address, 15, 10)}
                            </h4>
                            <span>
                                {formatAmount(
                                    new BigNumber(
                                        weiToSatoshi(balance).toString(),
                                    ),
                                    Denomination.Btc,
                                    separator(),
                                )}{" "}
                                {RBTC}
                            </span>
                        </div>
                    </div>
                )}
            </For>
            <div class="paginator">
                <div
                    classList={{ button: true, disabled: isFirstPage() }}
                    onClick={() => {
                        if (isFirstPage()) {
                            return;
                        }

                        setOffset(offset() - limit);
                    }}>
                    <ImArrowLeft2 />
                </div>
                <div
                    class="button"
                    onClick={() => {
                        setOffset(offset() + limit);
                    }}>
                    <ImArrowRight2 />
                </div>
            </div>
        </Show>
    );
};

const CustomPath = (props: {
    provider: Accessor<EIP6963ProviderInfo>;
    setLoading: Setter<boolean>;
}) => {
    const { t, notify, hardwareDerivationPath, setHardwareDerivationPath } =
        useGlobalContext();
    const { connectProvider, providers, setWalletConnected } = useWeb3Signer();

    const [path, setPath] = createSignal<string>(hardwareDerivationPath());

    const updatePath = (input: HTMLInputElement) => {
        setPath(input.value);
    };

    return (
        <div>
            <div
                class="provider-modal-entry"
                style={{ cursor: "default", "padding-top": "0" }}>
                <h4>Custom</h4>
                <input
                    type="text"
                    value={path()}
                    data-testid="derivation-path"
                    placeholder={derivationPaths.Ethereum}
                    onInput={(e) => updatePath(e.currentTarget)}
                    onKeyUp={(e) => updatePath(e.currentTarget)}
                    onPaste={(e) => updatePath(e.currentTarget)}
                />
            </div>

            <div
                class="provider-modal-entry"
                style={{ cursor: "default", "padding-top": "0" }}>
                <button
                    class="btn"
                    style={{ "margin-top": "0" }}
                    disabled={path() === undefined || path() === ""}
                    onClick={async () => {
                        setHardwareDerivationPath(path());
                        const connected = await connectHardware(
                            notify,
                            connectProvider,
                            props.provider,
                            providers,
                            path(),
                            props.setLoading,
                        );
                        setWalletConnected(connected);
                    }}>
                    {t("submit_derivation_path")}
                </button>
            </div>
        </div>
    );
};

const HardwareDerivationPaths = (props: {
    show: Accessor<boolean>;
    setShow: Setter<boolean>;
    provider: Accessor<EIP6963ProviderInfo>;
}) => {
    const { t } = useGlobalContext();

    const [loading, setLoading] = createSignal<boolean>(false);
    const [basePath, setBasePath] = createSignal<string | undefined>();

    const paths = createMemo(() => {
        switch (config.network) {
            case "mainnet":
                return {
                    ...derivationPaths,
                    ...derivationPathsMainnet,
                };

            case "testnet":
                return {
                    ...derivationPaths,
                    ...derivationPathsTestnet,
                };

            default:
                return {
                    ...derivationPaths,
                    ...derivationPathsMainnet,
                    ...derivationPathsTestnet,
                };
        }
    });

    const close = () => {
        props.setShow(false);
        setBasePath(undefined);
    };

    return (
        <div
            class="frame assets-select"
            onClick={() => close()}
            style={props.show() ? "display: block;" : "display: none;"}>
            <div onClick={(e) => e.stopPropagation()}>
                <h2>{t("select_derivation_path")}</h2>
                <span class="close" onClick={() => close()}>
                    <IoClose />
                </span>
                <hr class="spacer" />
                <Show when={!loading()} fallback={<LoadingSpinner />}>
                    <Show
                        when={basePath() === undefined}
                        fallback={
                            <HwAddressSelection
                                basePath={basePath}
                                setLoading={setLoading}
                                setBasePath={setBasePath}
                                provider={props.provider}
                            />
                        }>
                        <For
                            each={Object.entries(paths()).sort(([a], [b]) =>
                                a.toLowerCase().localeCompare(b.toLowerCase()),
                            )}>
                            {([name, path]) => (
                                <DerivationPath
                                    name={name}
                                    path={path}
                                    setBasePath={setBasePath}
                                />
                            )}
                        </For>
                        <hr style={{ "margin-top": "0" }} />
                        <CustomPath
                            provider={props.provider}
                            setLoading={setLoading}
                        />
                    </Show>
                </Show>
            </div>
        </div>
    );
};

export default HardwareDerivationPaths;
