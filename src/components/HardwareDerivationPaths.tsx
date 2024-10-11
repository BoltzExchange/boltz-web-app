import log from "loglevel";
import { IoClose } from "solid-icons/io";
import {
    Accessor,
    For,
    Setter,
    Show,
    createMemo,
    createSignal,
} from "solid-js";

import { config } from "../config";
import type {
    EIP6963ProviderDetail,
    EIP6963ProviderInfo,
} from "../consts/Types";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { formatError } from "../utils/errors";
import {
    HardwareSigner,
    derivationPaths,
    derivationPathsTestnet,
} from "../utils/hardware/HadwareSigner";
import LoadingSpinner from "./LoadingSpinner";

export const connect = async (
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

        const hardwareProvider = provider();
        const prov = providers()[hardwareProvider.rdns]
            .provider as unknown as HardwareSigner;
        prov.setDerivationPath(path);

        await connect(notify, connectProvider, hardwareProvider);
    } finally {
        setLoading(false);
    }
};

const DerivationPath = ({
    name,
    path,
    provider,
    setLoading,
}: {
    name: string;
    path: string;
    provider: Accessor<EIP6963ProviderInfo>;
    setLoading: Setter<boolean>;
}) => {
    const { notify } = useGlobalContext();
    const { connectProvider, providers } = useWeb3Signer();

    return (
        <div
            class="provider-modal-entry-wrapper"
            onClick={async () => {
                await connectHardware(
                    notify,
                    connectProvider,
                    provider,
                    providers,
                    path,
                    setLoading,
                );
            }}>
            <hr />
            <div class="provider-modal-entry">
                <h4>{name}</h4>
                <span>{path}</span>
            </div>
        </div>
    );
};

const CustomPath = ({
    provider,
    setLoading,
}: {
    provider: Accessor<EIP6963ProviderInfo>;
    setLoading: Setter<boolean>;
}) => {
    const { t, notify, hardwareDerivationPath, setHardwareDerivationPath } =
        useGlobalContext();
    const { connectProvider, providers } = useWeb3Signer();

    const [path, setPath] = createSignal<string>(hardwareDerivationPath());

    const updatePath = (input: HTMLInputElement) => {
        setPath(input.value);
    };

    return (
        <div>
            <div
                class="provider-modal-entry"
                style={"cursor: default; padding-top: 0;"}>
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
                style={"cursor: default; padding-top: 0;"}>
                <button
                    class="btn"
                    style={"margin-top: 0;"}
                    disabled={path() === undefined || path() === ""}
                    onClick={async () => {
                        setHardwareDerivationPath(path());
                        await connectHardware(
                            notify,
                            connectProvider,
                            provider,
                            providers,
                            path(),
                            setLoading,
                        );
                    }}>
                    {t("submit_derivation_path")}
                </button>
            </div>
        </div>
    );
};

const HardwareDerivationPaths = ({
    show,
    setShow,
    provider,
}: {
    show: Accessor<boolean>;
    setShow: Setter<boolean>;
    provider: Accessor<EIP6963ProviderInfo>;
}) => {
    const { t } = useGlobalContext();

    const [loading, setLoading] = createSignal<boolean>(false);

    const paths = createMemo(() => {
        if (config.network === "testnet") {
            return {
                ...derivationPaths,
                ...derivationPathsTestnet,
            };
        }

        return derivationPaths;
    });

    return (
        <div
            class="frame assets-select"
            onClick={() => setShow(false)}
            style={show() ? "display: block;" : "display: none;"}>
            <div onClick={(e) => e.stopPropagation()}>
                <h2>{t("select_derivation_path")}</h2>
                <span class="close" onClick={() => setShow(false)}>
                    <IoClose />
                </span>
                <hr class="spacer" />
                <Show when={!loading()} fallback={<LoadingSpinner />}>
                    <For
                        each={Object.entries(paths()).sort(([a], [b]) =>
                            a.toLowerCase().localeCompare(b.toLowerCase()),
                        )}>
                        {([name, path]) => (
                            <DerivationPath
                                name={name}
                                path={path}
                                provider={provider}
                                setLoading={setLoading}
                            />
                        )}
                    </For>
                    <hr style={"margin-top: 0;"} />
                    <CustomPath provider={provider} setLoading={setLoading} />
                </Show>
            </div>
        </div>
    );
};

export default HardwareDerivationPaths;
