export const defaultTimeoutDuration = 15_000;

export type BoltzConfiguration = {
    apiUrl: string | (() => string);
    referralId?: string | (() => string);
    cooperativeDisabled?: boolean | (() => boolean);
    defaultTimeout?: number;
};

let _config: BoltzConfiguration | null = null;

export const init = (config: BoltzConfiguration) => {
    _config = config;
};

export const getConfig = (): BoltzConfiguration => {
    if (!_config) {
        throw new Error(
            "boltz-sdk not initialized. Call init() before using SDK functions.",
        );
    }
    return _config;
};

export const resolveValue = <T>(value: T | (() => T)): T =>
    typeof value === "function" ? (value as () => T)() : value;

