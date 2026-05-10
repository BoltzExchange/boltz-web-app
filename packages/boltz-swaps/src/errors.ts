const walletRejectionPhrases = [
    "user rejected the request",
    "user rejected action",
    "user denied transaction signature",
    "rejectallapprovals",
] as const;

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

export const isWalletRejectionError = (message: unknown): boolean => {
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

let walletRejectionMessage = "Wallet request rejected";

export const setWalletRejectionMessage = (message: string): void => {
    walletRejectionMessage = message;
};

export const formatError = (message: unknown): string => {
    if (isWalletRejectionError(message)) {
        return walletRejectionMessage;
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
