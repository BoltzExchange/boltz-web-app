import type { TronConnector } from "@reown/appkit-adapter-tron";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import type { AppKitNetwork } from "@reown/appkit/networks";
import log from "loglevel";
import { createEffect, createResource, createSignal, untrack } from "solid-js";

import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import { getEvmAssets } from "../consts/Assets";
import { useWeb3Signer, walletConnectRdns } from "../context/Web3";
import loader from "../lazy/walletConnect";
import type {
    RawEvmProvider,
    WalletConnectRuntimeProvider,
} from "../utils/WalletConnectProvider";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import { isIos } from "../utils/helper";
import { buildWalletConnectNetworks } from "../utils/walletConnectNetworks";

type WalletConnectNamespace = "eip155" | "solana" | "tron";

const getWalletConnectNamespace = (
    transport: NetworkTransport,
): WalletConnectNamespace => {
    switch (transport) {
        case NetworkTransport.Evm:
            return "eip155";

        case NetworkTransport.Solana:
            return "solana";

        case NetworkTransport.Tron:
            return "tron";

        default: {
            const exhaustiveCheck: never = transport;
            throw new Error(
                `Unhandled WalletConnect transport: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

const getLocation = () => {
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
};

const getNumericCaipNetworkId = (
    caipNetwork: AppKitNetwork | undefined,
): number | undefined => {
    const chainId = caipNetwork?.id;

    if (typeof chainId === "number") {
        return chainId;
    }

    return undefined;
};

export const WalletConnect = () => {
    const {
        openWalletConnectModal,
        setOpenWalletConnectModal,
        connectedWallet,
        providers,
        restoreWalletConnectEvmSession,
    } = useWeb3Signer();
    const [pendingEvmSession, setPendingEvmSession] = createSignal<
        | {
              reason: string;
              evmProvider: RawEvmProvider | undefined;
              caipNetwork: AppKitNetwork | undefined;
              evmAddress: string;
          }
        | undefined
    >(undefined);

    const syncWalletConnectEvmSession = async (
        reason: string,
        evmProvider: RawEvmProvider | undefined,
        caipNetwork: AppKitNetwork | undefined,
        evmAddress: string | undefined,
    ) => {
        if (WalletConnectProvider.isDisconnecting()) {
            return;
        }

        const numericCaipNetworkId = getNumericCaipNetworkId(caipNetwork);
        if (numericCaipNetworkId !== undefined) {
            WalletConnectProvider.setEvmChainId(numericCaipNetworkId);
        } else if (caipNetwork?.id !== undefined) {
            log.warn("WalletConnect: ignoring non-numeric CAIP network id", {
                chainId: caipNetwork.id,
            });
        }

        if (evmProvider !== undefined) {
            WalletConnectProvider.setRawEvmProvider(evmProvider);
        }

        if (evmAddress === undefined) {
            return;
        }

        const activeWallet = untrack(() => connectedWallet());
        if (
            activeWallet !== undefined &&
            activeWallet.rdns !== walletConnectRdns
        ) {
            return;
        }

        if (WalletConnectProvider.hasPendingConnect()) {
            log.debug(
                `WalletConnect: skipping EVM session restore during active connect (${reason})`,
            );
            return;
        }

        const restored = await restoreWalletConnectEvmSession(
            evmAddress,
            numericCaipNetworkId,
        );
        if (!restored) {
            setPendingEvmSession({
                reason,
                evmProvider,
                caipNetwork,
                evmAddress,
            });
            log.debug(`WalletConnect: queued EVM session restore (${reason})`);
            return;
        }

        setPendingEvmSession(undefined);
        log.debug(`WalletConnect: restored EVM session (${reason})`);
    };

    const queueWalletConnectEvmSessionSync = (
        reason: string,
        evmProvider: RawEvmProvider | undefined,
        caipNetwork: AppKitNetwork | undefined,
        evmAddress: string | undefined,
    ) => {
        void syncWalletConnectEvmSession(
            reason,
            evmProvider,
            caipNetwork,
            evmAddress,
        ).catch((error) => {
            log.error(
                `WalletConnect: failed to sync EVM session (${reason})`,
                error,
            );
        });
    };

    const [createdKit] = createResource(async () => {
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (projectId === undefined) {
            log.warn("WalletConnect project id not set");
            return undefined;
        }

        const {
            appKit,
            EthersAdapter,
            SolanaAdapter,
            TronAdapter,
            solana,
            tronMainnet,
        } = await loader.get();
        let nets: [AppKitNetwork, ...AppKitNetwork[]];
        try {
            nets = [
                ...buildWalletConnectNetworks(config.assets, getEvmAssets()),
                solana,
                tronMainnet,
            ] as [AppKitNetwork, ...AppKitNetwork[]];
        } catch (error) {
            log.error(`WalletConnect network config invalid: ${String(error)}`);
            return undefined;
        }

        const created = appKit.createAppKit({
            projectId,
            themeMode: "dark",
            enableEIP6963: false,
            enableInjected: false,
            adapters: [
                new EthersAdapter(),
                new SolanaAdapter(),
                new TronAdapter(),
            ],
            networks: nets,
            metadata: {
                name: "Boltz",
                description: "Boltz Web App",
                url: getLocation(),
                icons: [`${getLocation()}/android-chrome-512x512.png`],
            },
            features: {
                email: false,
                socials: false,
                analytics: false,
            },
        });

        created.subscribeEvents((ev) => {
            const evmProvider = created.getProvider<RawEvmProvider>("eip155");
            const caipNetwork = created.getCaipNetwork();
            const evmAddress = created.getAddress("eip155");
            log.debug(`WalletConnect event: ${ev.data.event}`);

            if (ev.data.event !== "MODAL_CLOSE") {
                queueWalletConnectEvmSessionSync(
                    ev.data.event,
                    evmProvider,
                    caipNetwork,
                    evmAddress,
                );
                setOpenWalletConnectModal(false);
                return;
            }

            const transport = WalletConnectProvider.getRequestedTransport();
            const namespace = getWalletConnectNamespace(transport);
            const address = created.getAddress(namespace);

            if (transport === NetworkTransport.Evm) {
                queueWalletConnectEvmSessionSync(
                    ev.data.event,
                    evmProvider,
                    caipNetwork,
                    evmAddress,
                );
            }

            let provider: WalletConnectRuntimeProvider | undefined;
            switch (transport) {
                case NetworkTransport.Evm:
                    provider = evmProvider;
                    break;

                case NetworkTransport.Solana:
                    provider =
                        created.getProvider<SolanaWalletProvider>("solana");
                    break;

                case NetworkTransport.Tron:
                    provider = created.getProvider<TronConnector>("tron");
                    break;

                default: {
                    const exhaustiveCheck: never = transport;
                    throw new Error(
                        `Unhandled WalletConnect transport: ${String(exhaustiveCheck)}`,
                    );
                }
            }

            WalletConnectProvider.resolveClosePromise(
                transport,
                provider,
                address,
            );
        });

        return created;
    });

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (openWalletConnectModal()) {
            const kit = createdKit();
            if (kit === undefined) {
                log.warn(
                    "WalletConnect: modal requested before AppKit instance was ready",
                );
                return;
            }

            const transport = WalletConnectProvider.getRequestedTransport();

            if (
                transport === NetworkTransport.Evm &&
                WalletConnectProvider.isTrustWallet() &&
                isIos()
            ) {
                const requestedChainId =
                    WalletConnectProvider.getRequestedEvmChainId();
                if (requestedChainId !== undefined) {
                    const caipNetworks = kit.getCaipNetworks("eip155");
                    const targetNet = caipNetworks.find(
                        (n) => n.id === requestedChainId,
                    );
                    if (targetNet) {
                        kit.setCaipNetwork(targetNet);
                    } else {
                        log.warn(
                            `WalletConnect: requested chain ${String(requestedChainId)} not found in CAIP networks`,
                        );
                    }
                }
            }

            await kit.open({
                namespace: getWalletConnectNamespace(transport),
            });
        }
    });

    createEffect(() => {
        const kit = createdKit();
        if (kit === undefined) {
            return;
        }

        WalletConnectProvider.setDisconnectHandler(async (transport) => {
            await kit.disconnect(getWalletConnectNamespace(transport));
        });

        const evmProvider = kit.getProvider<RawEvmProvider>("eip155");
        const evmAddress = kit.getAddress("eip155");
        const caipNetwork = kit.getCaipNetwork();
        if (evmProvider !== undefined && evmAddress !== undefined) {
            queueWalletConnectEvmSessionSync(
                "RESOURCE_READY",
                evmProvider,
                caipNetwork,
                evmAddress,
            );
        }
    });

    createEffect(() => {
        const queuedSession = pendingEvmSession();
        const walletConnectProvider = providers()[walletConnectRdns]?.provider;
        if (
            queuedSession === undefined ||
            walletConnectProvider === undefined
        ) {
            return;
        }

        queueWalletConnectEvmSessionSync(
            `${queuedSession.reason}:PROVIDER_READY`,
            queuedSession.evmProvider,
            queuedSession.caipNetwork,
            queuedSession.evmAddress,
        );
    });

    return <></>;
};
