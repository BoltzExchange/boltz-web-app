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

/**
 * Extract a human-readable error message from an unknown value.
 *
 * Handles plain strings, objects with `error.message`, `message`, `error`,
 * or `data` properties, and falls back to `JSON.stringify`.
 *
 * @param message - The unknown error value to format.
 * @returns A string representation of the error.
 */
export const formatError = (message: unknown): string => {
    if (typeof message === "string") {
        return message;
    }

    if (typeof message === "object" && message !== null) {
        const msgObj = message as Record<string, unknown>;

        if (typeof msgObj.error === "object") {
            const err = msgObj.error as Record<string, unknown>;

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
