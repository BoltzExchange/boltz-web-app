export const defaultTimeoutDuration = 15_000;

export const constructRequestOptions = (
    options: RequestInit = {},
    timeout: number = defaultTimeoutDuration,
) => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort({ reason: "Request timed out" }),
        timeout,
    );

    const opts: RequestInit = {
        signal: controller.signal,
        ...options,
    };

    return { opts, requestTimeout };
};
