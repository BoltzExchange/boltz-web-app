import type { TronConnector } from "@reown/appkit-adapter-tron";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import type { BrowserProvider } from "ethers";
import type { Setter } from "solid-js";

import { NetworkTransport } from "../configs/base";
import type { EIP1193Provider } from "../consts/Types";
import type { DictKey } from "../i18n/i18n";

export type WalletConnectAccount = {
    address: string;
    transport: NetworkTransport;
};

export type WalletConnectRuntimeProvider =
    | BrowserProvider
    | SolanaWalletProvider
    | TronConnector;

class WalletConnectProvider implements EIP1193Provider {
    private static openModal: Setter<boolean>;
    private static t: (
        key: DictKey,
        values?: Record<string, unknown>,
    ) => string;

    private static accountRequestResolver: {
        resolve: (addresses: string[]) => void;
        reject: (reason?: unknown) => void;
    };
    private static connectPromiseResolver: {
        resolve: (account: WalletConnectAccount) => void;
        reject: (reason?: unknown) => void;
    };
    private static requestedTransport = NetworkTransport.Evm;

    private static providers: Partial<
        Record<NetworkTransport, WalletConnectRuntimeProvider>
    > = {};

    constructor() {}

    public static initialize = (
        t: typeof WalletConnectProvider.t,
        openModal: Setter<boolean>,
    ) => {
        WalletConnectProvider.t = t;
        WalletConnectProvider.openModal = openModal;
    };

    public static getRequestedTransport = (): NetworkTransport =>
        WalletConnectProvider.requestedTransport;

    public static getSolanaProvider = (): SolanaWalletProvider => {
        const provider =
            WalletConnectProvider.providers[NetworkTransport.Solana];
        if (provider === undefined) {
            throw new Error("wallet connect solana provider not initialized");
        }

        return provider as SolanaWalletProvider;
    };

    public static getTronProvider = (): TronConnector => {
        const provider = WalletConnectProvider.providers[NetworkTransport.Tron];
        if (provider === undefined) {
            throw new Error("wallet connect tron provider not initialized");
        }

        return provider as TronConnector;
    };

    public static connect = (
        transport: NetworkTransport,
    ): Promise<WalletConnectAccount> => {
        WalletConnectProvider.requestedTransport = transport;
        WalletConnectProvider.openModal(true);

        return new Promise<WalletConnectAccount>((resolve, reject) => {
            WalletConnectProvider.connectPromiseResolver = {
                resolve,
                reject,
            };
        });
    };

    public static resolveClosePromise = (
        transport: NetworkTransport,
        provider: WalletConnectRuntimeProvider | undefined,
        address: string | undefined,
    ) => {
        if (address !== undefined && provider !== undefined) {
            WalletConnectProvider.providers[transport] = provider;
        }

        if (WalletConnectProvider.accountRequestResolver !== undefined) {
            if (address === undefined || provider === undefined) {
                WalletConnectProvider.accountRequestResolver.reject(
                    this.t("no_wallet_connected"),
                );
            } else {
                WalletConnectProvider.accountRequestResolver.resolve([address]);
            }

            WalletConnectProvider.accountRequestResolver = undefined;
        }

        if (WalletConnectProvider.connectPromiseResolver !== undefined) {
            if (address === undefined) {
                WalletConnectProvider.connectPromiseResolver.reject(
                    this.t("no_wallet_connected"),
                );
            } else {
                WalletConnectProvider.connectPromiseResolver.resolve({
                    address,
                    transport,
                });
            }

            WalletConnectProvider.connectPromiseResolver = undefined;
        }
    };

    public request = async (request: {
        method: string;
        params?: Array<unknown>;
    }) => {
        switch (request.method) {
            case "eth_requestAccounts": {
                WalletConnectProvider.requestedTransport = NetworkTransport.Evm;
                WalletConnectProvider.openModal(true);
                return new Promise<string[]>((resolve, reject) => {
                    WalletConnectProvider.accountRequestResolver = {
                        resolve,
                        reject,
                    };
                });
            }
        }

        const provider = WalletConnectProvider.providers[NetworkTransport.Evm];
        if (provider === undefined) {
            throw new Error("wallet connect provider not initialized");
        }

        return (await (provider as BrowserProvider).send(
            request.method,
            request.params,
        )) as never;
    };

    public on = () => {};

    public removeAllListeners = () => {};
}

export default WalletConnectProvider;
