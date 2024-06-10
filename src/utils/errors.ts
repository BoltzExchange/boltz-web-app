export const formatError = (message: unknown): string => {
    if (typeof message === "string") {
        return message;
    } else if (
        typeof message.toString === "function" &&
        message.toString() !== "[object Object]"
    ) {
        return message.toString();
    } else {
        return JSON.stringify(message);
    }
};
