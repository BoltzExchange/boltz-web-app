import log from "loglevel";
import { createEffect, createResource } from "solid-js";
import { networks, wagmiConfig } from "src/config/wagmi";
import { type Address, createWalletClient, custom } from "viem";

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

        const { appKit, WagmiAdapter } = await loader.get();
        const adapter = new WagmiAdapter({
            networks,
            projectId:
                import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
                "boltz-web-app",
        });
        const created = appKit.createAppKit({
            projectId,
            themeMode: "dark",
            enableEIP6963: false,
            enableInjected: false,
            adapters: [adapter],
            networks: [...adapter.wagmiChains],
            defaultNetwork: adapter.wagmiChains[0],
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
            const transport = custom(await created.getUniversalProvider());
            const walletClient = createWalletClient({
                account: address as Address,
                chain: wagmiConfig.chains[0],
                transport,
            });

            WalletConnectProvider.resolveClosePromise(walletClient, address);
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
