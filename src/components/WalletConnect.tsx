import { BrowserProvider } from "ethers";
import log from "loglevel";
import { createEffect, createMemo, createResource } from "solid-js";

import { config } from "../config";
import { evmChains } from "../consts/Assets";
import { useWeb3Signer } from "../context/Web3";
import loader from "../lazy/walletConnect";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import { buildWalletConnectNetworks } from "../utils/walletConnectNetworks";

const getLocation = () => {
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
};

export const WalletConnect = () => {
    const { openWalletConnectModal, setOpenWalletConnectModal } =
        useWeb3Signer();

    const networks = createMemo(() => {
        try {
            return buildWalletConnectNetworks(config.assets, evmChains);
        } catch (error) {
            log.error(`WalletConnect network config invalid: ${String(error)}`);
            return undefined;
        }
    });

    const [createdKit] = createResource(async () => {
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (projectId === undefined) {
            log.warn("WalletConnect project id not set");
            return undefined;
        }

        const nets = networks();
        if (nets === undefined) {
            return undefined;
        }

        const { appKit, EthersAdapter } = await loader.get();
        const created = appKit.createAppKit({
            projectId,
            themeMode: "dark",
            enableEIP6963: false,
            enableInjected: false,
            adapters: [new EthersAdapter()],
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
