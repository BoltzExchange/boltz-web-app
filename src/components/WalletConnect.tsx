import { BrowserProvider } from "ethers";
import log from "loglevel";
import { createEffect, createResource } from "solid-js";

import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { useWeb3Signer } from "../context/Web3";
import loader from "../lazy/walletConnect";
import WalletConnectProvider from "../utils/WalletConnectProvider";

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

        const configRsk = config.assets[RBTC];

        const { appKit, EthersAdapter } = await loader.get();
        const created = appKit.createAppKit({
            projectId,
            themeMode: "dark",
            enableEIP6963: false,
            enableInjected: false,
            adapters: [new EthersAdapter()],
            networks: [
                {
                    id: configRsk.network.chainId,
                    name: configRsk.network.chainName,
                    nativeCurrency: {
                        name: RBTC,
                        symbol: RBTC,
                        decimals: 18,
                    },
                    rpcUrls: {
                        default: {
                            http: configRsk.network.rpcUrls,
                        },
                    },
                    blockExplorers: {
                        default: {
                            name: "Explorer",
                            url: configRsk.blockExplorerUrl.normal,
                        },
                    },
                },
            ],
            metadata: {
                name: "Boltz",
                description: "Boltz Web App",
                url: getLocation(),
                icons: [`${getLocation()}/android-chrome-512x512.png`],
            },
            features: {
                email: false,
                socials: false,
                analytics: true,
            },
        });

        created.subscribeEvents(async (ev) => {
            log.debug(`WalletConnect event: ${ev.data.event}`);

            if (ev.data.event !== "MODAL_CLOSE") {
                setOpenWalletConnectModal(false);
                return;
            }

            const address = created.getAddress();
            const provider = new BrowserProvider(
                await created.getUniversalProvider(),
            );

            WalletConnectProvider.resolveClosePromise(provider, address);
        });

        return created;
    });

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (openWalletConnectModal()) {
            const kit = createdKit();

            if (kit !== undefined) {
                await kit.open();
            }
        }
    });

    return <></>;
};
