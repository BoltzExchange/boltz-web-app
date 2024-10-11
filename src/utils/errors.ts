export const formatError = (message: unknown): string => {
    if (typeof message === "string") {
        return message;
    }

    if (typeof message === "object") {
        const msgObj = message as Record<string, any>;

        if (typeof msgObj.error === "object") {
            if (typeof msgObj.error.message === "string") {
                return msgObj.error.message;
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
            message.toString() !== "[object Object]"
        ) {
            return message.toString();
        }
    }

    return JSON.stringify(message);
};
