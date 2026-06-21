import { type Address, type Hash, type Hex, toHex } from "viem";

import { getGasSponsorUrl } from "../config.ts";
import { formatError } from "../errors.ts";
import type { AlchemyCall } from "../interfaces/alchemy.ts";
import type { Signer } from "../interfaces/signer.ts";
import { getLogger } from "../logger.ts";
import { prefix0x } from "./prefix0x.ts";

export type { AlchemyCall } from "../interfaces/alchemy.ts";

const alchemyHeaders = {
    accept: "application/json",
    "content-type": "application/json",
} as const;
const jsonRpcVersion = "2.0";
const jsonRpcId = 1;
const requestTimeoutMs = 60_000;

type JsonRpcError = {
    code: number;
    message: string;
    data?: unknown;
};

type JsonRpcResponse<T> = {
    id: number | string | null;
    jsonrpc: string;
    result?: T;
    error?: JsonRpcError;
};

type JsonRpcSuccessResponse<T> = {
    id: number | string | null;
    jsonrpc: string;
    result: T;
};

const truncateBody = (body: string, limit = 500): string =>
    body.length > limit
        ? `${body.slice(0, limit)}…(${body.length} bytes)`
        : body;

const parseAlchemyResponse = <T>(
    rawBody: string,
    method: string,
    response: Response,
): JsonRpcResponse<T> => {
    try {
        return JSON.parse(rawBody) as JsonRpcResponse<T>;
    } catch {
        throw new Error(
            `Alchemy returned invalid JSON for ${method} (HTTP ${response.status} ${response.statusText})`,
        );
    }
};

const requestAlchemy = async <T extends JsonRpcSuccessResponse<unknown>>(
    method: string,
    params: unknown[],
): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response: Response;
    let rawBody: string;
    try {
        response = await fetch(getGasSponsorUrl(), {
            method: "POST",
            headers: alchemyHeaders,
            body: JSON.stringify({
                id: jsonRpcId,
                jsonrpc: jsonRpcVersion,
                method,
                params,
            }),
            signal: controller.signal,
        });
        rawBody = await response.text();
    } catch (error) {
        if (controller.signal.aborted) {
            getLogger().error(
                `Alchemy ${method} timed out after ${requestTimeoutMs}ms`,
                error,
            );
            throw new Error(
                `Alchemy request timed out for ${method} after ${requestTimeoutMs}ms`,
                { cause: error },
            );
        }
        getLogger().error(`Alchemy ${method} fetch failed`, error);
        throw new Error(
            `Alchemy request failed for ${method}: ${formatError(error)}`,
            { cause: error },
        );
    } finally {
        clearTimeout(timer);
    }

    const payload = parseAlchemyResponse<T>(rawBody, method, response);

    if (!response.ok) {
        const errorDetails =
            payload.error !== undefined
                ? `${payload.error.code} ${payload.error.message}`
                : truncateBody(rawBody);
        getLogger().error(
            `Alchemy ${method} HTTP ${response.status} ${response.statusText}`,
            payload.error ?? truncateBody(rawBody),
        );
        throw new Error(
            `Alchemy HTTP error for ${method}: ${response.status} ${response.statusText} (${errorDetails})`,
        );
    }

    if (payload.error !== undefined) {
        getLogger().error(`Alchemy ${method} RPC error`, payload.error);
        throw new Error(
            `Alchemy RPC error for ${method}: ${payload.error.code} ${payload.error.message}`,
        );
    }

    if (payload.result === undefined) {
        getLogger().error(
            `Alchemy ${method} response missing result: ${truncateBody(rawBody)}`,
        );
        throw new Error(`Alchemy response for ${method} is missing result`);
    }

    return {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: payload.result,
    } as T;
};

const prepareCalls = (
    signerAddress: Address,
    chainId: string,
    calls: AlchemyCall[],
) =>
    requestAlchemy<PrepareCallsResponse>("wallet_prepareCalls", [
        { calls, from: signerAddress, chainId },
    ]);

type SignatureRequest = {
    rawPayload?: string;
    data?: { raw: string };
};

type PrepareCallsEntry = {
    type: string;
    data: unknown;
    chainId: string;
    signatureRequest: SignatureRequest;
};

type PrepareCallsResult = {
    type: string;
    data: PrepareCallsEntry[] | Record<string, unknown>;
    chainId?: string;
    signatureRequest?: SignatureRequest;
};

type PrepareCallsResponse = JsonRpcSuccessResponse<PrepareCallsResult>;

type SignedEntry = {
    type: string;
    data: unknown;
    chainId: string;
    signature: { type: string; data: string };
};

type SendPreparedCallsResponse = JsonRpcSuccessResponse<{
    preparedCallIds: string[];
}>;

type CallsStatusReceipt = {
    transactionHash: string;
    status: string;
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
};

type GetCallsStatusResponse = JsonRpcSuccessResponse<{
    status: number;
    receipts?: CallsStatusReceipt[];
}>;

export type SendAlchemyTransactionOptions = {
    existingCallId?: string;
    onPreparedCallId?: (callId: string) => Promise<void> | void;
};

export const toAlchemyCall = (transaction: {
    to?: Address | null;
    data?: Hex;
    value?: bigint;
}): AlchemyCall => {
    if (transaction.to == null) {
        throw new Error("transaction is missing destination address");
    }

    return {
        to: transaction.to,
        data: transaction.data,
        value:
            transaction.value !== undefined
                ? String(transaction.value)
                : undefined,
    };
};

const signAuthorizationDigest = async (
    signer: Signer,
    hash: Hex,
): Promise<Hex> => {
    if (signer.account.type !== "local" || signer.account.sign === undefined) {
        throw new Error(
            "Alchemy authorization signing requires a local signer",
        );
    }
    return await signer.account.sign({ hash });
};

const signPreparedCalls = async (
    signer: Signer,
    prepareCallsResponse: PrepareCallsResponse,
): Promise<SignedEntry[] | SignedEntry> => {
    const { result } = prepareCallsResponse;

    if (result.type === "array") {
        if (!Array.isArray(result.data)) {
            throw new Error(
                'signPreparedCalls: expected result.data to be an array when result.type="array"',
            );
        }

        const entries = result.data as PrepareCallsEntry[];
        if (entries.length < 2) {
            throw new Error(
                `signPreparedCalls: expected entries.length >= 2 for array result, got ${entries.length}`,
            );
        }

        const authEntry = entries[0];
        const uoEntry = entries[1];
        if (uoEntry.type !== "user-operation-v070") {
            throw new Error(
                `signPreparedCalls: entries[1].type expected "user-operation-v070", got "${uoEntry.type}"`,
            );
        }

        // Sign the 7702 authorization as a raw digest (no EIP-191 prefix).
        const authPayload = authEntry.signatureRequest.rawPayload;
        if (authPayload === undefined) {
            throw new Error(
                "Alchemy prepareCalls response is missing authorization payload",
            );
        }
        const authSignature = await signAuthorizationDigest(
            signer,
            authPayload as Hex,
        );

        // Sign the user operation.
        const uoPayload = uoEntry.signatureRequest.data?.raw;
        if (uoPayload === undefined) {
            throw new Error(
                "Alchemy prepareCalls response is missing user operation payload",
            );
        }
        const uoSignature = await signer.signMessage({
            account: signer.account,
            message: { raw: uoPayload as Hex },
        });

        return [
            {
                type: authEntry.type,
                data: authEntry.data,
                chainId: authEntry.chainId,
                signature: { type: "secp256k1", data: authSignature },
            },
            {
                type: uoEntry.type,
                data: uoEntry.data,
                chainId: uoEntry.chainId,
                signature: { type: "secp256k1", data: uoSignature },
            },
        ];
    }

    // Subsequent transactions: sign only the user operation.
    const payload = result.signatureRequest?.data?.raw;
    if (payload === undefined) {
        throw new Error(
            "Alchemy prepareCalls response is missing user operation payload",
        );
    }
    const signature = await signer.signMessage({
        account: signer.account,
        message: { raw: payload as Hex },
    });
    if (result.chainId === undefined) {
        throw new Error("Alchemy prepareCalls response is missing chainId");
    }

    return {
        type: result.type,
        data: result.data,
        chainId: result.chainId,
        signature: { type: "secp256k1", data: signature },
    };
};

const sendPreparedCalls = async (
    signedData: SignedEntry[] | SignedEntry,
): Promise<string> => {
    const params = Array.isArray(signedData)
        ? [{ type: "array", data: signedData }]
        : [signedData];

    const response = await requestAlchemy<SendPreparedCallsResponse>(
        "wallet_sendPreparedCalls",
        params,
    );
    const callId = response.result.preparedCallIds[0];
    if (callId === undefined) {
        throw new Error(
            "Alchemy sendPreparedCalls response does not include a prepared call ID",
        );
    }
    return callId;
};

const getCallsStatus = (callId: string): Promise<GetCallsStatusResponse> =>
    requestAlchemy<GetCallsStatusResponse>("wallet_getCallsStatus", [callId]);

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const waitForTransactionHash = async (
    callId: string,
    intervalMs = 1_000,
    maxAttempts = 60,
): Promise<Hash> => {
    let lastStatusError: unknown;
    let consecutiveErrors = 0;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const status = await getCallsStatus(callId);
            if (consecutiveErrors > 0) {
                getLogger().info(
                    `Alchemy getCallsStatus recovered for call ${callId} after ${consecutiveErrors} consecutive failure(s)`,
                );
            }
            consecutiveErrors = 0;
            lastStatusError = undefined;

            const receipts = status.result.receipts;
            if (receipts !== undefined && receipts.length > 0) {
                const hash = receipts[0].transactionHash as Hash;
                getLogger().debug(
                    `Alchemy call ${callId} confirmed after ${i + 1} poll(s): ${hash}`,
                );
                return hash;
            }
        } catch (error) {
            lastStatusError = error;
            consecutiveErrors++;
            if (consecutiveErrors === 1 || consecutiveErrors % 10 === 0) {
                getLogger().warn(
                    `Alchemy getCallsStatus failed for call ${callId} (attempt ${i + 1}/${maxAttempts}, ${consecutiveErrors} consecutive)`,
                    error,
                );
            }
        }
        await sleep(intervalMs);
    }

    if (lastStatusError !== undefined) {
        getLogger().error(
            `Alchemy call ${callId} status unavailable after ${maxAttempts} attempts`,
            lastStatusError,
        );
        throw new Error(
            `Alchemy call ${callId} status unavailable after ${maxAttempts} attempts: ${formatError(lastStatusError)}`,
        );
    }
    getLogger().error(
        `Alchemy call ${callId} not confirmed after ${maxAttempts} polls (no receipts returned)`,
    );
    throw new Error(
        `Alchemy call ${callId} not confirmed after ${maxAttempts} attempts`,
    );
};

/**
 * Submit a batch of calls through the configured Alchemy-compatible gas sponsor
 * (EIP-7702 account abstraction) and wait for the resulting transaction hash.
 * Requires a local signer (for the authorization digest signature).
 */
export const sendAlchemyTransaction = async (
    signer: Signer,
    chainId: bigint,
    calls: AlchemyCall[],
    options: SendAlchemyTransactionOptions = {},
): Promise<Hash> => {
    if (options.existingCallId !== undefined) {
        return waitForTransactionHash(options.existingCallId);
    }

    const normalizedCalls = calls.map((call) => ({
        to: call.to,
        value: call.value ? toHex(BigInt(call.value)) : undefined,
        data: call.data ? prefix0x(call.data) : undefined,
    }));

    getLogger().debug("Sending transaction via Alchemy gas sponsor", calls);

    const prepared = await prepareCalls(
        signer.address,
        prefix0x(chainId.toString(16)),
        normalizedCalls,
    );
    const signed = await signPreparedCalls(signer, prepared);
    const callId = await sendPreparedCalls(signed);
    await options.onPreparedCallId?.(callId);
    return waitForTransactionHash(callId);
};

export const waitForPreparedCallTransactionHash = (
    callId: string,
): Promise<Hash> => waitForTransactionHash(callId);
