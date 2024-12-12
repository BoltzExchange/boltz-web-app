import type { BrowserProvider } from "ethers";
import { Setter } from "solid-js";

import { EIP1193Provider } from "../consts/Types";
import type { DictKey } from "../i18n/i18n";

class WalletConnectProvider implements EIP1193Provider {
    private static openModal: Setter<boolean>;
    private static t: (
        key: DictKey,
        values?: Record<string, unknown>,
    ) => string;

    private static closePromiseResolver: {
        resolve: (addresses: string[]) => void;
        reject: (reason?: unknown) => void;
    };

    private static provider: BrowserProvider;

    constructor() {}

    public static initialize = (
        t: typeof WalletConnectProvider.t,
        openModal: Setter<boolean>,
    ) => {
        WalletConnectProvider.t = t;
        WalletConnectProvider.openModal = openModal;
    };

    public static resolveClosePromise = (
        provider: BrowserProvider,
        address: string,
    ) => {
        if (WalletConnectProvider.closePromiseResolver === undefined) {
            return;
        }
        if (address === undefined) {
            WalletConnectProvider.closePromiseResolver.reject(
                this.t("no_wallet_connected"),
            );
        } else {
            WalletConnectProvider.provider = provider;
            WalletConnectProvider.closePromiseResolver.resolve([address]);
        }

        WalletConnectProvider.closePromiseResolver = undefined;
    };

    public request = async (request: {
        method: string;
        params?: Array<unknown>;
    }) => {
        switch (request.method) {
            case "eth_requestAccounts": {
                WalletConnectProvider.openModal(true);
                return new Promise<string[]>((resolve, reject) => {
                    WalletConnectProvider.closePromiseResolver = {
                        resolve,
                        reject,
                    };
                });
            }
        }

        return (await WalletConnectProvider.provider.send(
            request.method,
            request.params,
        )) as never;
    };

    public on = () => {};

    public removeAllListeners = () => {};
}

export default WalletConnectProvider;
