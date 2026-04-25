import type { TronConnector } from "@reown/appkit-adapter-tron";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import type { BrowserProvider } from "ethers";
import log from "loglevel";
import type { Setter } from "solid-js";

import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import type { EIP1193Provider } from "../consts/Types";
import type { DictKey } from "../i18n/i18n";
import { createProvider } from "./provider";

export type RawEvmProvider = {
    request: (
        request: {
            method: string;
            params?: Array<unknown>;
        },
        chain?: string,
        expiry?: number,
    ) => Promise<unknown>;
    setDefaultChain?: (caipChainId: string) => void;
    session?: {
        peer?: {
            metadata?: {
                name?: string;
            };
        };
    };
};

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

    // cached EVM session state for local `eth_chainId` / `eth_accounts`
    private static evmChainId: string | undefined;
    private static rawEvmProvider: RawEvmProvider | undefined;
    private static evmAddress: string | undefined;

    // read-only methods we route straight to JSON-RPC instead of the WC relay
    private static readonly evmReadOnlyMethods: ReadonlySet<string> = new Set([
        "eth_call",
        "eth_estimateGas",
        "eth_gasPrice",
        "eth_maxPriorityFeePerGas",
        "eth_feeHistory",
        "eth_blockNumber",
        "eth_getBalance",
        "eth_getCode",
        "eth_getTransactionByHash",
        "eth_getTransactionCount",
        "eth_getTransactionReceipt",
    ]);

    private static evmReadOnlyRpcChainId: string | undefined;
    private static evmReadOnlyRpc:
        | { send: (method: string, params: unknown[]) => Promise<unknown> }
        | undefined;

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

    public static setEvmChainId = (chainId: number | undefined) => {
        if (chainId === undefined) {
            WalletConnectProvider.evmChainId = undefined;
            return;
        }
        WalletConnectProvider.evmChainId = `0x${chainId.toString(16)}`;
        WalletConnectProvider.syncDefaultChain();
    };

    public static setRawEvmProvider = (
        provider: RawEvmProvider | undefined,
    ) => {
        WalletConnectProvider.rawEvmProvider = provider;
        WalletConnectProvider.syncDefaultChain();
    };

    public static isTrustWallet = () => {
        const walletName =
            WalletConnectProvider.rawEvmProvider?.session?.peer?.metadata?.name;
        return walletName?.trim().toLowerCase() === "trust wallet";
    };

    public static requestRawEvm = async (
        request: { method: string; params?: Array<unknown> },
        chainId?: number,
    ) => {
        const provider = WalletConnectProvider.rawEvmProvider;
        if (provider === undefined) {
            throw new Error("wallet connect provider not initialized");
        }

        if (chainId !== undefined) {
            WalletConnectProvider.setEvmChainId(chainId);
        }

        return await provider.request(
            request,
            chainId !== undefined ? `eip155:${chainId}` : undefined,
        );
    };

    // reuse a JSON-RPC provider for the cached EVM chain when available
    private static getEvmReadOnlyRpc = () => {
        const chainIdHex = WalletConnectProvider.evmChainId;
        if (chainIdHex === undefined) {
            return undefined;
        }
        if (
            WalletConnectProvider.evmReadOnlyRpc !== undefined &&
            WalletConnectProvider.evmReadOnlyRpcChainId === chainIdHex
        ) {
            return WalletConnectProvider.evmReadOnlyRpc;
        }
        const chainId = parseInt(chainIdHex, 16);
        const rpcUrls = Object.values(config.assets ?? {}).find(
            (asset) =>
                asset?.network?.transport === NetworkTransport.Evm &&
                asset.network.chainId === chainId,
        )?.network?.rpcUrls;
        if (rpcUrls === undefined || rpcUrls.length === 0) {
            return undefined;
        }
        try {
            WalletConnectProvider.evmReadOnlyRpc = createProvider(rpcUrls);
            WalletConnectProvider.evmReadOnlyRpcChainId = chainIdHex;
            return WalletConnectProvider.evmReadOnlyRpc;
        } catch (error) {
            log.warn(
                "WalletConnectProvider: failed to create read-only RPC provider",
                error,
            );
            return undefined;
        }
    };

    private static syncDefaultChain = () => {
        const provider = WalletConnectProvider.rawEvmProvider;
        const chainIdHex = WalletConnectProvider.evmChainId;
        if (
            provider === undefined ||
            chainIdHex === undefined ||
            provider.setDefaultChain === undefined
        ) {
            return;
        }
        try {
            provider.setDefaultChain(`eip155:${parseInt(chainIdHex, 16)}`);
        } catch (error) {
            log.warn(
                "WalletConnectProvider: setDefaultChain threw, continuing without explicit routing",
                error,
            );
        }
    };

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

        if (transport === NetworkTransport.Evm) {
            WalletConnectProvider.evmAddress = address;
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

        if (
            request.method === "eth_chainId" &&
            WalletConnectProvider.evmChainId !== undefined
        ) {
            return WalletConnectProvider.evmChainId as never;
        }

        if (
            request.method === "eth_accounts" &&
            WalletConnectProvider.evmAddress !== undefined
        ) {
            return [WalletConnectProvider.evmAddress] as never;
        }

        if (WalletConnectProvider.evmReadOnlyMethods.has(request.method)) {
            const rpc = WalletConnectProvider.getEvmReadOnlyRpc();
            if (rpc !== undefined) {
                return (await rpc.send(
                    request.method,
                    (request.params ?? []) as unknown[],
                )) as never;
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
