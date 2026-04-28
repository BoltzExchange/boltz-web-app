import { config } from "../../config";
import { constructRequestOptions } from "../helper";

const requestTimeoutDuration = 6_000;

type CctpMessagesResponse = {
    messages?: unknown;
};

type CctpMessageSnapshot = {
    forwardTxHash?: string;
    message?: string;
    attestation?: string;
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
): Promise<CctpMessageSnapshot> => {
    const { opts, requestTimeout } = constructRequestOptions(
        {
            headers: {
                Accept: "application/json",
            },
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
