import type { FetchOptions } from "../types.ts";

export const defaultFetchTimeoutMs = 25_000;

// Combines the caller signal with an end-to-end timeout that aborts
// in-flight requests.
export const timeoutSignal = (opts?: FetchOptions): AbortSignal => {
    const timeout = AbortSignal.timeout(
        opts?.timeoutMs ?? defaultFetchTimeoutMs,
    );
    return opts?.signal != null
        ? AbortSignal.any([opts.signal, timeout])
        : timeout;
};
