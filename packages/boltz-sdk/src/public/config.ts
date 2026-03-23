import { type AssetKind } from "./enums";
import { ConfigError, NotInitializedError } from "./errors";

/** Supported Bitcoin network types. */
export type NetworkType = "mainnet" | "testnet" | "regtest";

/** ERC-20 token configuration for an asset. */
export type AssetToken = {
    address: string;
    decimals: number;
    /** When set, DEX swaps for this token are routed via another asset. */
    routeVia?: string;
};

/** EVM smart-contract addresses for an asset's chain. */
export type AssetContracts = {
    deployHeight: number;
    router?: string;
    smartWalletFactory?: string;
    deployVerifier?: string;
};

/** EVM chain network parameters for wallet/provider configuration. */
export type AssetNetwork = {
    chainName: string;
    symbol?: string;
    chainId: number;
    rpcUrls: string[];
    /** Native gas token symbol for DEX gas-top-up quotes (e.g. `"ETH"`). */
    gasToken?: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
};

/** Per-asset configuration (chain details, contracts, token info). */
export type Asset = {
    type: AssetKind;
    /** When `false`, routing treats this asset as non-sendable (same as web app). */
    canSend?: boolean;
    blockExplorerUrl?: { id: string; normal: string; tor?: string };
    blockExplorerApis?: { id: string; normal: string; tor?: string }[];
    rifRelay?: string;
    contracts?: AssetContracts;
    network?: AssetNetwork;
    token?: AssetToken;
};

/** Public HTTP endpoints used for fiat/gas-token price lookups (optional). */
export type RateProviderUrls = {
    Yadio?: string;
    Kraken?: string;
    Mempool?: string;
    CoinGecko?: string;
};

/**
 * Configuration object for the Boltz SDK.
 *
 * Pass to {@link init} before calling any other SDK function.
 * Values may be static or getter functions so they can react to runtime changes.
 */
export type BoltzConfiguration = {
    /** Boltz API base URL (e.g. `"https://api.boltz.exchange"`). */
    apiUrl: string | (() => string);
    /** Bitcoin network. Defaults to `"mainnet"` when omitted. */
    network?: NetworkType | (() => NetworkType);
    /** Optional partner referral identifier sent with every API request. */
    referralId?: string | (() => string);
    /** Disable cooperative (MuSig) claim/refund signatures. For testing only. */
    cooperativeDisabled?: boolean | (() => boolean);
    /** Default HTTP request timeout in milliseconds. */
    defaultTimeout?: number;
    /** Per-asset chain/contract/token configuration. */
    assets?: Record<string, Asset>;
    /**
     * Fiat price API base URLs for gas-top-up calculations in routing (`Pair`).
     * Defaults match the Boltz web app when omitted.
     */
    rateProviders?: RateProviderUrls;
};

const validNetworks: NetworkType[] = ["mainnet", "testnet", "regtest"];

/** Internal singleton holding the current configuration. */
let boltzConfig: BoltzConfiguration | null = null;

/** @internal Reset the config singleton. Only for use in tests. */
export const _resetForTesting = () => {
    boltzConfig = null;
};

/**
 * Initialise the SDK with the given configuration.
 *
 * Must be called once before any other SDK function is used.
 *
 * @param config - SDK configuration options.
 * @throws {ConfigError} If required fields are missing or invalid.
 */
export const init = (config: BoltzConfiguration) => {
    if (!config || typeof config !== "object") {
        throw new ConfigError("config must be a non-null object");
    }

    const url =
        typeof config.apiUrl === "function" ? config.apiUrl() : config.apiUrl;
    if (typeof url !== "string" || url.trim() === "") {
        throw new ConfigError(
            "apiUrl is required and must be a non-empty string or getter",
        );
    }

    if (config.network !== undefined) {
        const net =
            typeof config.network === "function"
                ? config.network()
                : config.network;
        if (!validNetworks.includes(net)) {
            throw new ConfigError(
                `network must be one of: ${validNetworks.join(", ")}`,
            );
        }
    }

    if (
        config.defaultTimeout !== undefined &&
        (typeof config.defaultTimeout !== "number" || config.defaultTimeout <= 0)
    ) {
        throw new ConfigError("defaultTimeout must be a positive number");
    }

    boltzConfig = config;
};

/**
 * Return the current SDK configuration.
 *
 * @throws {NotInitializedError} If {@link init} has not been called yet.
 */
export const getConfig = (): BoltzConfiguration => {
    if (!boltzConfig) {
        throw new NotInitializedError();
    }
    return boltzConfig;
};
