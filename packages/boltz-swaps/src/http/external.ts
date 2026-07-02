import { formatError } from "../errors.ts";

export const fetchExternalJson = async <T = unknown>(
    url: string,
    timeoutMs = 15_000,
    init?: RequestInit,
): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(new Error("Request timed out")),
        timeoutMs,
    );

    try {
        const signal =
            init?.signal != null
                ? AbortSignal.any([controller.signal, init.signal])
                : controller.signal;
        const response = await fetch(url, { ...init, signal });
        if (!response.ok) {
            return Promise.reject(await errorFromResponse(response));
        }
        return (await response.json()) as T;
    } finally {
        clearTimeout(timeout);
    }
};

const errorFromResponse = async (response: Response): Promise<Error> => {
    try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
            return new Error(formatError(await response.json()));
        }
        const text = await response.text();
        if (text !== "") {
            return new Error(text);
        }
    } catch {
        // fall through
    }
    return new Error(`request failed with status ${response.status}`);
};
