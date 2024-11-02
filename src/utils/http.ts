import { formatError } from "./errors";

export const checkResponse = <T = unknown>(response: Response): Promise<T> => {
    if (!response.ok) {
        return Promise.reject(new Error(formatError(response)));
    }
    return response.json();
};
