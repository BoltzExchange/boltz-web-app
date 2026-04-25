import type { TronConnector } from "@reown/appkit-adapter-tron";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { BrowserProvider } from "ethers";
import log from "loglevel";
import { createEffect, createResource } from "solid-js";

import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import { getEvmAssets } from "../consts/Assets";
import { useWeb3Signer } from "../context/Web3";
import loader from "../lazy/walletConnect";
import type {
    RawEvmProvider,
    WalletConnectRuntimeProvider,
} from "../utils/WalletConnectProvider";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import { buildWalletConnectNetworks } from "../utils/walletConnectNetworks";

const getWalletConnectNamespace = (
    transport: NetworkTransport,
): "eip155" | "solana" | "tron" => {
    switch (transport) {
        case NetworkTransport.Evm:
            return "eip155";

        case NetworkTransport.Solana:
            return "solana";

        case NetworkTransport.Tron:
            return "tron";
    }
};

const getLocation = () => {
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
};

export const WalletConnect = () => {
    const { openWalletConnectModal, setOpenWalletConnectModal } =
        useWeb3Signer();

    const [createdKit] = createResource(async () => {
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (projectId === undefined) {
            log.warn("WalletConnect project id not set");
            return undefined;
        }

        const {
            appKit,
            EthersAdapter,
            MetaMaskAdapter,
            SolanaAdapter,
            TronAdapter,
            TronLinkAdapter,
            solana,
            tronMainnet,
        } = await loader.get();
        const location = getLocation();
        const appIcon = `${location}/android-chrome-512x512.png`;
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
                new TronAdapter({
                    walletAdapters: [
                        new TronLinkAdapter({
                            dappIcon: appIcon,
                            dappName: "Boltz",
                        }),
                        new MetaMaskAdapter(),
                    ],
                }),
            ],
            networks: nets,
            metadata: {
                name: "Boltz",
                description: "Boltz Web App",
                url: location,
                icons: [appIcon],
            },
            features: {
                email: false,
                socials: false,
                analytics: false,
            },
        });

        let lastWalletConnectEvent: string | undefined;
        created.subscribeEvents((ev) => {
            if (ev.data.event !== lastWalletConnectEvent) {
                log.debug(`WalletConnect event: ${ev.data.event}`);
                lastWalletConnectEvent = ev.data.event;
            }

            if (ev.data.event !== "MODAL_CLOSE") {
                setOpenWalletConnectModal(false);
                return;
            }

            const transport = WalletConnectProvider.getRequestedTransport();
            const namespace = getWalletConnectNamespace(transport);
            const address = created.getAddress(namespace);
            let provider: WalletConnectRuntimeProvider | undefined;
            switch (transport) {
                case NetworkTransport.Evm: {
                    const evmProvider =
                        created.getProvider<RawEvmProvider>(namespace);
                    const chainId = created.getCaipNetwork(namespace)?.id;

                    if (
                        evmProvider === undefined ||
                        typeof chainId !== "number"
                    ) {
                        WalletConnectProvider.setRawEvmProvider(undefined);
                        WalletConnectProvider.setEvmChainId(undefined);
                        break;
                    }

                    provider = new BrowserProvider(evmProvider);
                    WalletConnectProvider.setRawEvmProvider(evmProvider);
                    WalletConnectProvider.setEvmChainId(chainId);
                    break;
                }

                case NetworkTransport.Solana:
                    provider =
                        created.getProvider<SolanaWalletProvider>(namespace);
                    break;

                case NetworkTransport.Tron:
                    provider = created.getProvider<TronConnector>(namespace);
                    break;
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

            if (kit !== undefined) {
                await kit.open({
                    namespace: getWalletConnectNamespace(
                        WalletConnectProvider.getRequestedTransport(),
                    ),
                });
            }
        }
    });

    return <></>;
};
