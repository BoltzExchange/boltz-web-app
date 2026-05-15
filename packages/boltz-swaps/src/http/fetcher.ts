import { getBoltzApiUrl, getReferralHeader } from "../config.ts";
import { formatError } from "../errors.ts";

// Default timeout for non-Tor requests; host can override per-call. Tor
// detection is host-side, so the host bootstrap is expected to supply a
// longer timeout when running over Tor via the `requestTimeoutDuration`
// parameter at the call sites that care (none today — 15s suffices for all
// current consumers).
const defaultTimeoutDuration = 15_000;

export const fetcher = async <T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: RequestInit,
    requestTimeoutDuration: number = defaultTimeoutDuration,
): Promise<T> => {
    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort({ reason: "Request timed out" }),
        requestTimeoutDuration,
    );

    try {
        const referral = getReferralHeader();
        const baseHeaders: Record<string, string> = {};
        if (referral !== undefined) {
            baseHeaders.referral = referral;
        }

        let opts: RequestInit = {
            headers: baseHeaders,
            signal: controller.signal,
        };

        if (params) {
            opts = {
                method: "POST",
                headers: {
                    ...(options ? options.headers : opts.headers),
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify(params),
            };
        }

        const apiUrl = getBoltzApiUrl() + url;
        const response = await fetch(apiUrl, options || opts);

        if (!response.ok) {
            try {
                const contentType = response.headers.get("content-type");
                if (contentType?.includes("application/json")) {
                    const body = await response.json();
                    return Promise.reject(formatError(body));
                }
                return Promise.reject(await response.text());

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return Promise.reject(response);
            }
        }
        return (await response.json()) as T;
    } catch (e) {
        throw new Error(formatError(e), { cause: e });
    } finally {
        clearTimeout(requestTimeout);
    }
};
