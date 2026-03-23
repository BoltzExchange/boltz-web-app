/** Base error class for all SDK errors. */
export class BoltzError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "BoltzError";
    }
}

/** The SDK has not been initialised via {@link init}. */
export class NotInitializedError extends BoltzError {
    constructor() {
        super(
            "boltz-sdk not initialized. Call init() before using SDK functions.",
        );
        this.name = "NotInitializedError";
    }
}

/** The SDK configuration is invalid. */
export class ConfigError extends BoltzError {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

/** An HTTP request to the Boltz API failed. */
export class ApiError extends BoltzError {
    /** HTTP status code, if available. */
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

/** A swap-related validation or state error. */
export class SwapError extends BoltzError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "SwapError";
    }
}

const walletRejectionPhrases = [
    "user rejected action",
    "user denied transaction signature",
    "ethers-user-denied",
    "rejectallapprovals",
] as const;

const defaultWalletRejectionMessage = "Wallet request rejected";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const getRecord = (
    record: Record<string, unknown>,
    key: string,
): Record<string, unknown> | undefined => {
    const value = record[key];
    return isRecord(value) ? value : undefined;
};

const hasWalletRejectionCode = (value: unknown): boolean =>
    value === "ACTION_REJECTED" || value === 4001 || value === "4001";

const hasWalletRejectionPhrase = (value: unknown): boolean =>
    typeof value === "string" &&
    walletRejectionPhrases.some((phrase) =>
        value.toLowerCase().includes(phrase),
    );

const getWalletRejectionFields = (
    message: Record<string, unknown>,
): {
    codes: unknown[];
    phrases: unknown[];
} => {
    const error = getRecord(message, "error");
    const info = getRecord(message, "info");
    const infoError = info ? getRecord(info, "error") : undefined;
    const data = getRecord(message, "data");
    const infoErrorData = infoError ? getRecord(infoError, "data") : undefined;

    return {
        codes: [message.code, error?.code, infoError?.code],
        phrases: [
            message.message,
            error?.message,
            infoError?.message,
            data?.cause,
            infoErrorData?.cause,
        ],
    };
};

const isWalletRejectionError = (message: unknown): boolean => {
    if (hasWalletRejectionPhrase(message)) {
        return true;
    }

    if (!isRecord(message)) {
        return false;
    }

    const { codes, phrases } = getWalletRejectionFields(message);

    return (
        codes.some((code) => hasWalletRejectionCode(code)) ||
        phrases.some((phrase) => hasWalletRejectionPhrase(phrase))
    );
};

/**
 * Extract a human-readable error message from an unknown value.
 *
 * Detects common wallet-rejection error patterns and returns a
 * normalised message for those. Otherwise handles plain strings,
 * objects with `error.message`, `message`, `error`, or `data`
 * properties, and falls back to `JSON.stringify`.
 *
 * @param message - The unknown error value to format.
 * @param walletRejectionMessage - Custom message to return for wallet rejections
 *   (defaults to `"Wallet request rejected"`).
 * @returns A string representation of the error.
 */
export const formatError = (
    message: unknown,
    walletRejectionMessage?: string,
): string => {
    if (isWalletRejectionError(message)) {
        return walletRejectionMessage ?? defaultWalletRejectionMessage;
    }

    if (typeof message === "string") {
        return message;
    }

    if (isRecord(message)) {
        const msgObj = message;

        if (isRecord(msgObj.error)) {
            const err = msgObj.error;

            if (typeof err.message === "string") {
                return err.message;
            }
        }

        if (typeof msgObj.message === "string") {
            return msgObj.message;
        }

        if (typeof msgObj.error === "string") {
            return msgObj.error;
        }

        if (typeof msgObj.data === "string") {
            return msgObj.data;
        }

        if (
            typeof message.toString === "function" &&
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            message.toString() !== "[object Object]"
        ) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            return message.toString();
        }
    }

    return JSON.stringify(message);
};
