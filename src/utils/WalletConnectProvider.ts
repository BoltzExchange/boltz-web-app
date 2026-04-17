import type { TronConnector } from "@reown/appkit-adapter-tron";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { getAddress, toQuantity } from "ethers";
import log from "loglevel";
import type { Setter } from "solid-js";

import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import type { EIP1193Provider } from "../consts/Types";
import type { DictKey } from "../i18n/i18n";
import { isIos } from "./helper";
import { type Provider, createProvider } from "./provider";

const walletMethods = new Set([
    "eth_sendTransaction",
    "eth_sign",
    "eth_signTransaction",
    "eth_signTypedData",
    "eth_signTypedData_v3",
    "eth_signTypedData_v4",
    "personal_sign",
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
    "eth_requestAccounts",
    "eth_accounts",
]);

const toEvenQuantity = (value: unknown): string => {
    const hex = toQuantity(value as never);
    return hex.length % 2 === 1 ? `0x0${hex.slice(2)}` : hex;
};

const evenPaddedQuantityFields = [
    "gas",
    "gasPrice",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "nonce",
] as const;

export type WalletConnectAccount = {
    address: string;
    transport: NetworkTransport;
};

export type RawEvmProvider = {
    request: (request: {
        method: string;
        params?: Array<unknown>;
    }) => Promise<unknown>;
    setDefaultChain?: (caipChainId: string, rpcUrl?: string) => void;
    session?: {
        peer?: {
            metadata?: {
                name?: string;
                url?: string;
            };
        };
    };
};

export type WalletConnectRuntimeProvider =
    | RawEvmProvider
    | SolanaWalletProvider
    | TronConnector;

type DisconnectHandler = (transport: NetworkTransport) => Promise<void>;

class WalletConnectProvider implements EIP1193Provider {
    private static openModal: Setter<boolean>;
    private static disconnectHandler: DisconnectHandler | undefined;
    private static disconnecting = false;
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
    private static requestedEvmChainId: number | undefined;

    private static providers: Partial<
        Record<NetworkTransport, WalletConnectRuntimeProvider>
    > = {};

    private static rawEvmProvider: RawEvmProvider | undefined;

    private static evmChainId: string | undefined;
    private static evmNumericChainId: number | undefined;
    private static lastSyncedCaipChainId: string | undefined;
    private static lastSyncedProvider: RawEvmProvider | undefined;

    private static evmRpcProvider: Provider | undefined;

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

    public static getRequestedEvmChainId = (): number | undefined =>
        WalletConnectProvider.requestedEvmChainId;

    public static hasPendingConnect = (): boolean =>
        WalletConnectProvider.connectPromiseResolver !== undefined ||
        WalletConnectProvider.accountRequestResolver !== undefined;

    public static isTrustWallet = (): boolean => {
        const metadata =
            WalletConnectProvider.rawEvmProvider?.session?.peer?.metadata;
        if (metadata === undefined) {
            return false;
        }

        const normalizedName = metadata.name?.trim().toLowerCase();
        if (normalizedName === "trust wallet") {
            return true;
        }

        const normalizedUrl = metadata.url
            ?.trim()
            .toLowerCase()
            .replace(/\/$/, "");
        return normalizedUrl === "https://trustwallet.com";
    };

    public static getSolanaProvider = (): SolanaWalletProvider => {
        const provider =
            WalletConnectProvider.providers[NetworkTransport.Solana];
        if (provider === undefined) {
            throw new Error("wallet connect solana provider not initialized");
        }

        return provider as SolanaWalletProvider;
    };

    public static connect = (
        transport: NetworkTransport,
        evmChainId?: number,
    ): Promise<WalletConnectAccount> => {
        WalletConnectProvider.requestedTransport = transport;
        WalletConnectProvider.requestedEvmChainId = evmChainId;
        WalletConnectProvider.openModal(true);

        return new Promise<WalletConnectAccount>((resolve, reject) => {
            WalletConnectProvider.connectPromiseResolver = {
                resolve,
                reject,
            };
        });
    };

    public static clearEvmState = () => {
        log.debug("WalletConnectProvider: clearing cached EVM state");
        WalletConnectProvider.rawEvmProvider = undefined;
        WalletConnectProvider.evmChainId = undefined;
        WalletConnectProvider.evmNumericChainId = undefined;
        WalletConnectProvider.evmRpcProvider = undefined;
        WalletConnectProvider.lastSyncedCaipChainId = undefined;
        WalletConnectProvider.lastSyncedProvider = undefined;
    };

    public static setDisconnectHandler = (
        handler: DisconnectHandler | undefined,
    ) => {
        WalletConnectProvider.disconnectHandler = handler;
    };

    public static isDisconnecting = () => WalletConnectProvider.disconnecting;

    public static disconnect = async (transport: NetworkTransport) => {
        const handler = WalletConnectProvider.disconnectHandler;
        WalletConnectProvider.disconnecting = true;
        try {
            if (transport === NetworkTransport.Evm) {
                WalletConnectProvider.clearEvmState();
            }
            WalletConnectProvider.providers[transport] = undefined;

            if (handler === undefined) {
                log.warn(
                    "WalletConnectProvider: disconnect requested but no handler is registered",
                    { transport },
                );
                return;
            }

            try {
                await handler(transport);
            } catch (error) {
                log.warn("WalletConnectProvider: disconnect handler threw", {
                    transport,
                    error,
                });
            }
        } finally {
            WalletConnectProvider.disconnecting = false;
        }
    };

    private static describeProvider = (provider: unknown) => {
        if (provider === undefined) {
            return "undefined";
        }

        if (provider === null || typeof provider !== "object") {
            return typeof provider;
        }

        return (
            (provider as { constructor?: { name?: string } }).constructor
                ?.name ?? "Object"
        );
    };

    public static getEvmDebugState = () => ({
        requestedEvmChainId: WalletConnectProvider.requestedEvmChainId,
        cachedChainId: WalletConnectProvider.evmChainId,
        hasRawProvider: WalletConnectProvider.rawEvmProvider !== undefined,
    });

    // Only Trust Wallet on iOS needs us to drive AppKit's UniversalProvider
    // default chain ourselves. For every other WalletConnect wallet, calling
    // setDefaultChain can surface AppKit's known `No matching key. session
    // topic doesn't exist` rejection (reown-com/appkit#5545)
    private static syncDefaultChain = () => {
        const provider = WalletConnectProvider.rawEvmProvider;
        const chainId = WalletConnectProvider.evmNumericChainId;
        if (provider === undefined || chainId === undefined) {
            return;
        }

        if (!WalletConnectProvider.isTrustWallet() || !isIos()) {
            return;
        }

        if (provider.setDefaultChain === undefined) {
            log.warn(
                "WalletConnectProvider: raw provider has no setDefaultChain method",
            );
            return;
        }

        const caipChainId = `eip155:${chainId}`;
        if (
            WalletConnectProvider.lastSyncedProvider === provider &&
            WalletConnectProvider.lastSyncedCaipChainId === caipChainId
        ) {
            return;
        }

        log.debug(
            `WalletConnectProvider: setting default chain to ${caipChainId}`,
        );
        try {
            provider.setDefaultChain(caipChainId);
            WalletConnectProvider.lastSyncedProvider = provider;
            WalletConnectProvider.lastSyncedCaipChainId = caipChainId;
        } catch (error) {
            log.warn(
                `WalletConnectProvider: setDefaultChain(${caipChainId}) threw`,
                error,
            );
        }
    };

    public static setEvmChainId = (chainId: number | undefined) => {
        if (chainId === undefined) {
            log.warn(
                "WalletConnectProvider: attempted to cache undefined EVM chain id",
            );
            return;
        }

        WalletConnectProvider.evmChainId = `0x${chainId.toString(16)}`;
        WalletConnectProvider.evmNumericChainId = chainId;
        log.debug(
            `WalletConnectProvider: cached EVM chainId ${chainId} (${WalletConnectProvider.evmChainId})`,
        );

        const rpcUrls = Object.values(config.assets ?? {}).find(
            (a) => a.network?.chainId === chainId,
        )?.network?.rpcUrls;
        WalletConnectProvider.evmRpcProvider =
            rpcUrls !== undefined && rpcUrls.length > 0
                ? createProvider(rpcUrls)
                : undefined;

        WalletConnectProvider.syncDefaultChain();
    };

    // Rewrites `eth_sendTransaction` params so Trust Wallet on iOS accepts
    // them. Checksums `from`, injects `chainId`, pads hex quantities to even
    // length, and sets `data`/`value` defaults. Gated by caller so other WC
    // wallets continue to receive the stock ethers payload.
    private static rewriteTrustWalletIOSSendTx = (request: {
        method: string;
        params?: Array<unknown>;
    }) => {
        if (!Array.isArray(request.params) || request.params.length === 0) {
            return request;
        }
        const [firstParam, ...restParams] = request.params;
        if (firstParam === null || typeof firstParam !== "object") {
            return request;
        }

        const tx = { ...(firstParam as Record<string, unknown>) };

        if (typeof tx.from === "string") {
            try {
                tx.from = getAddress(tx.from);
            } catch {
                // leave as-is
            }
        }
        tx.data = tx.data ?? "0x";
        tx.value = tx.value != null ? toEvenQuantity(tx.value) : "0x00";
        for (const field of evenPaddedQuantityFields) {
            if (tx[field] != null) {
                tx[field] = toEvenQuantity(tx[field]);
            }
        }
        if (tx.chainId != null) {
            tx.chainId = toEvenQuantity(tx.chainId);
        } else if (WalletConnectProvider.evmChainId !== undefined) {
            tx.chainId = WalletConnectProvider.evmChainId;
        }

        log.debug(
            "WalletConnectProvider: rewrote eth_sendTransaction for Trust Wallet iOS",
            tx,
        );
        return { ...request, params: [tx, ...restParams] };
    };

    public static setRawEvmProvider = (
        provider: RawEvmProvider | undefined,
    ) => {
        if (WalletConnectProvider.rawEvmProvider !== provider) {
            WalletConnectProvider.lastSyncedCaipChainId = undefined;
            WalletConnectProvider.lastSyncedProvider = undefined;
        }
        WalletConnectProvider.rawEvmProvider = provider;
        log.debug("WalletConnectProvider: updated raw EVM provider", {
            provider: WalletConnectProvider.describeProvider(provider),
        });
        WalletConnectProvider.syncDefaultChain();
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
        if (request.method === "eth_requestAccounts") {
            WalletConnectProvider.requestedTransport = NetworkTransport.Evm;
            WalletConnectProvider.openModal(true);
            return new Promise<string[]>((resolve, reject) => {
                WalletConnectProvider.accountRequestResolver = {
                    resolve,
                    reject,
                };
            }) as never;
        }

        if (
            request.method === "eth_chainId" &&
            WalletConnectProvider.evmChainId !== undefined
        ) {
            return WalletConnectProvider.evmChainId as never;
        }

        // Trust Wallet on iOS rejects read-only calls through the WC relay
        // so route them to a direct JSON-RPC node. Other wallets keep the stock WC routing.
        if (
            !walletMethods.has(request.method) &&
            WalletConnectProvider.evmRpcProvider !== undefined &&
            WalletConnectProvider.isTrustWallet() &&
            isIos()
        ) {
            return (await WalletConnectProvider.evmRpcProvider.send(
                request.method,
                request.params ?? [],
            )) as never;
        }

        const provider = WalletConnectProvider.rawEvmProvider;
        if (provider === undefined) {
            throw new Error("wallet connect provider not initialized");
        }

        WalletConnectProvider.syncDefaultChain();

        const forwarded =
            request.method === "eth_sendTransaction" &&
            WalletConnectProvider.isTrustWallet() &&
            isIos()
                ? WalletConnectProvider.rewriteTrustWalletIOSSendTx(request)
                : request;

        return (await provider.request(forwarded)) as never;
    };

    public on = () => {};

    public removeAllListeners = () => {};
}

export default WalletConnectProvider;
