import { config } from "../../config";
import { constructRequestOptions } from "../helper";

const requestTimeoutDuration = 6_000;
const defaultPollIntervalMs = 2_000;

type CctpMessagesResponse = {
    messages?: unknown;
};

type CctpMessageSnapshot = {
    forwardTxHash?: string;
    message?: string;
    attestation?: string;
    status?: string;
};

export type CctpForwardProgress = {
    status?: string;
};

export type CctpForwardResult = {
    forwardTxHash: string;
    status?: string;
};

export type CctpAttestationResult = {
    message: string;
    attestation: string;
    status?: string;
};

const getCctpApiUrl = (): string => {
    const { cctpApiUrl } = config;
    if (cctpApiUrl === undefined || cctpApiUrl === "") {
        throw new Error("missing CCTP API URL");
    }
    return cctpApiUrl.endsWith("/") ? cctpApiUrl.slice(0, -1) : cctpApiUrl;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const readOptionalString = (
    entry: Record<string, unknown>,
    key: string,
): string | undefined => {
    const value = entry[key];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new Error(`invalid CCTP message ${key}`);
    }
    return value;
};

const isCompleteAttestation = (entry: {
    message?: string;
    attestation?: string;
    status?: string;
}): entry is { message: string; attestation: string; status?: string } =>
    entry.message !== undefined &&
    entry.message !== "0x" &&
    entry.attestation !== undefined &&
    entry.attestation !== "PENDING";

const fetchCctpMessage = async (
    sourceDomainId: number,
    sourceTxHash: string,
    signal?: AbortSignal,
): Promise<CctpMessageSnapshot> => {
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
        if (!Array.isArray(body.messages)) {
            throw new Error("invalid CCTP messages response");
        }

        const rawEntry = body.messages[0];
        if (rawEntry === undefined) {
            return {};
        }
        if (!isRecord(rawEntry)) {
            throw new Error("invalid CCTP message entry");
        }

        const entry = {
            forwardTxHash: readOptionalString(rawEntry, "forwardTxHash"),
            message: readOptionalString(rawEntry, "message"),
            attestation: readOptionalString(rawEntry, "attestation"),
            status: readOptionalString(rawEntry, "status"),
        };

        return entry;
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
        const result = await fetchCctpMessage(
            sourceDomainId,
            sourceTxHash,
            options.signal,
        );
        if (result.forwardTxHash !== undefined) {
            return {
                forwardTxHash: result.forwardTxHash,
                status: result.status,
            };
        }
        options.onProgress?.(result);
        await sleep(intervalMs, options.signal);
    }
};

export const getCctpAttestation = async (
    sourceDomainId: number,
    sourceTxHash: string,
): Promise<CctpAttestationResult | undefined> => {
    const result = await fetchCctpMessage(sourceDomainId, sourceTxHash);
    return isCompleteAttestation(result)
        ? {
              message: result.message,
              attestation: result.attestation,
              status: result.status,
          }
        : undefined;
};

// Non-polling single-shot check: returns the forward tx hash once available,
// otherwise undefined. Useful for synchronous UI polling loops that want to
// drive their own timing.
export const getCctpForwardTxHash = async (
    sourceDomainId: number,
    sourceTxHash: string,
): Promise<string | undefined> => {
    const result = await fetchCctpMessage(sourceDomainId, sourceTxHash);
    return result.forwardTxHash;
};
