import { config } from "../../config";
import { constructRequestOptions } from "../helper";

const requestTimeoutDuration = 6_000;
const defaultPollIntervalMs = 2_000;

type CctpMessageEntry = {
    // Present once Circle has attested and the Forwarding Service has
    // submitted the mint on the destination chain.
    forwardTxHash?: string;
    // Textual status Circle exposes; useful for progress surfacing.
    status?: string;
};

type CctpMessagesResponse = {
    messages?: CctpMessageEntry[];
};

export type CctpForwardProgress = {
    status?: string;
};

export type CctpForwardResult = {
    forwardTxHash: string;
    status?: string;
};

const getCctpApiUrl = (): string => {
    const { cctpApiUrl } = config;
    if (cctpApiUrl === undefined || cctpApiUrl === "") {
        throw new Error("missing CCTP API URL");
    }
    return cctpApiUrl.endsWith("/") ? cctpApiUrl.slice(0, -1) : cctpApiUrl;
};

const fetchCctpForwardTxHash = async (
    sourceDomainId: number,
    sourceTxHash: string,
    signal?: AbortSignal,
): Promise<CctpForwardResult | CctpForwardProgress> => {
    const { opts, requestTimeout } = constructRequestOptions(
        {
            headers: {
                Accept: "application/json",
            },
            signal,
        },
        requestTimeoutDuration,
    );

    try {
        const response = await fetch(
            `${getCctpApiUrl()}/v2/messages/${sourceDomainId}?transactionHash=${sourceTxHash}`,
            opts,
        );

        // Circle returns 404 until the burn tx is indexed; treat as "not ready".
        if (response.status === 404) {
            return {};
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const body = (await response.json()) as CctpMessagesResponse;
        const entry = body.messages?.[0];
        if (entry?.forwardTxHash) {
            return {
                forwardTxHash: entry.forwardTxHash,
                status: entry.status,
            };
        }
        return { status: entry?.status };
    } finally {
        clearTimeout(requestTimeout);
    }
};

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason);
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal?.reason);
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });

// Polls Circle's message API until the Forwarding Service has submitted the
// mint on the destination chain, returning the forward tx hash. Callers can
// subscribe to progress to surface Circle's textual status as polling advances.
export const waitForCctpForwardTxHash = async (
    sourceDomainId: number,
    sourceTxHash: string,
    options: {
        intervalMs?: number;
        signal?: AbortSignal;
        onProgress?: (progress: CctpForwardProgress) => void;
    } = {},
): Promise<CctpForwardResult> => {
    const intervalMs = options.intervalMs ?? defaultPollIntervalMs;

    while (true) {
        options.signal?.throwIfAborted();
        const result = await fetchCctpForwardTxHash(
            sourceDomainId,
            sourceTxHash,
            options.signal,
        );
        if ("forwardTxHash" in result) {
            return result;
        }
        options.onProgress?.(result);
        await sleep(intervalMs, options.signal);
    }
};

// Non-polling single-shot check: returns the forward tx hash once available,
// otherwise undefined. Useful for synchronous UI polling loops that want to
// drive their own timing.
export const getCctpForwardTxHash = async (
    sourceDomainId: number,
    sourceTxHash: string,
): Promise<string | undefined> => {
    const result = await fetchCctpForwardTxHash(sourceDomainId, sourceTxHash);
    return "forwardTxHash" in result ? result.forwardTxHash : undefined;
};
