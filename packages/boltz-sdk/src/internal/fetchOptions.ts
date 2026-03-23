/** Default timeout for auxiliary HTTP requests (rate providers, etc.). */
export const auxiliaryRequestTimeoutMs = 6_000;

/**
 * Build `fetch` options with an `AbortController` timeout.
 *
 * @returns Options plus a timer handle — caller must `clearTimeout` in `finally`.
 */
export const withFetchTimeout = (
    options: RequestInit = {},
    timeoutMs: number = auxiliaryRequestTimeoutMs,
): { opts: RequestInit; requestTimeout: ReturnType<typeof setTimeout> } => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort({ cause: "timeout" }),
        timeoutMs,
    );
    return {
        opts: { ...options, signal: controller.signal },
        requestTimeout,
    };
};
