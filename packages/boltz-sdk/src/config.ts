export type NetworkType = "mainnet" | "testnet" | "regtest";

export type BoltzConfiguration = {
    apiUrl: string | (() => string);
    network?: NetworkType | (() => NetworkType);
    referralId?: string | (() => string);
    cooperativeDisabled?: boolean | (() => boolean);
    defaultTimeout?: number;
};

/** Internal singleton holding the current configuration. */
let boltzConfig: BoltzConfiguration | null = null;

/**
 * Initialise the SDK with the given configuration.
 *
 * Must be called once before any other SDK function is used.
 *
 * @param config - SDK configuration options.
 */
export const init = (config: BoltzConfiguration) => {
    boltzConfig = config;
};

/**
 * Return the current SDK configuration.
 *
 * @throws If {@link init} has not been called yet.
 */
export const getConfig = (): BoltzConfiguration => {
    if (!boltzConfig) {
        throw new Error(
            "boltz-sdk not initialized. Call init() before using SDK functions.",
        );
    }
    return boltzConfig;
};
