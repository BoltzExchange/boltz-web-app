import {
    type TransactionRequest,
    type Wallet,
    getBytes,
    toBeHex,
} from "ethers";

import { formatError } from "../utils/errors";
import { constructRequestOptions } from "../utils/helper";

const alchemyHeaders = {
    accept: "application/json",
    "content-type": "application/json",
} as const;
const jsonRpcVersion = "2.0";
const jsonRpcId = 1;

const getAlchemyApiKey = (): string => {
    const key = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined;
    if (key === undefined) {
        throw new Error("VITE_ALCHEMY_API_KEY is not defined");
    }
    return key;
};

const alchemyUrl = () => `https://api.g.alchemy.com/v2/${getAlchemyApiKey()}`;

const getAlchemyGasPolicyId = (): string => {
    const id = import.meta.env.VITE_ALCHEMY_GAS_POLICY_ID as string | undefined;
    if (id === undefined) {
        throw new Error("VITE_ALCHEMY_GAS_POLICY_ID is not defined");
    }
    return id;
};

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
    let response: Response;
    const { opts, requestTimeout } = constructRequestOptions({
        method: "POST",
        headers: alchemyHeaders,
        body: JSON.stringify({
            id: jsonRpcId,
            jsonrpc: jsonRpcVersion,
            method,
            params,
        }),
    });

    try {
        response = await fetch(alchemyUrl(), opts);
    } catch (error) {
        const isAbortError =
            (error instanceof DOMException && error.name === "AbortError") ||
            opts.signal?.aborted === true;
        if (isAbortError) {
            throw new Error(`Alchemy request timed out for ${method}`);
        }

        throw new Error(
            `Alchemy request failed for ${method}: ${formatError(error)}`,
        );
    } finally {
        clearTimeout(requestTimeout);
    }

    const rawBody = await response.text();
    const payload = parseAlchemyResponse<T>(rawBody, method, response);

    if (!response.ok) {
        const errorDetails =
            payload.error !== undefined
                ? `${payload.error.code} ${payload.error.message}`
                : rawBody;
        throw new Error(
            `Alchemy HTTP error for ${method}: ${response.status} ${response.statusText} (${errorDetails})`,
        );
    }

    if (payload.error !== undefined) {
        throw new Error(
            `Alchemy RPC error for ${method}: ${payload.error.code} ${payload.error.message}`,
        );
    }

    if (payload.result === undefined) {
        throw new Error(`Alchemy response for ${method} is missing result`);
    }

    return {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: payload.result,
    } as T;
};

const prepareCalls = async (
    signerAddress: string,
    chainId: string,
    calls: AlchemyCall[],
) => {
    return await requestAlchemy<PrepareCallsResponse>("wallet_prepareCalls", [
        {
            capabilities: {
                paymasterService: {
                    policyId: getAlchemyGasPolicyId(),
                },
            },
            calls,
            from: signerAddress,
            chainId,
        },
    ]);
};

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

export type AlchemyCall = {
    to: string;
    data?: string;
    value?: string;
};

export const toAlchemyCall = (transaction: TransactionRequest): AlchemyCall => {
    if (typeof transaction.to !== "string") {
        throw new Error("transaction is missing destination address");
    }

    return {
        to: transaction.to,
        data:
            typeof transaction.data === "string" ? transaction.data : undefined,
        value:
            transaction.value !== undefined
                ? transaction.value.toString()
                : undefined,
    };
};

const signPreparedCalls = async (
    signer: Wallet,
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
                `signPreparedCalls: expected entries.length >= 2 for array result, got entries.length=${entries.length}`,
            );
        }

        const authEntry = entries[0];
        const uoEntry = entries[1];
        if (uoEntry.type !== "user-operation-v070") {
            throw new Error(
                `signPreparedCalls: entries[1].type expected "user-operation-v070", got "${uoEntry.type}"`,
            );
        }

        // Sign the 7702 authorization as a raw digest (no EIP-191 prefix)
        const authPayload = authEntry.signatureRequest.rawPayload;
        if (authPayload === undefined) {
            throw new Error(
                "Alchemy prepareCalls response is missing authorization payload",
            );
        }
        const authSignature = signer.signingKey.sign(authPayload).serialized;

        // Sign the user operation
        const uoPayload = uoEntry.signatureRequest.data?.raw;
        if (uoPayload === undefined) {
            throw new Error(
                "Alchemy prepareCalls response is missing user operation payload",
            );
        }
        const uoSignature = await signer.signMessage(getBytes(uoPayload));

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

    // Subsequent transactions: sign only the user operation
    const payload = result.signatureRequest?.data?.raw;
    if (payload === undefined) {
        throw new Error(
            "Alchemy prepareCalls response is missing user operation payload",
        );
    }
    const signature = await signer.signMessage(getBytes(payload));

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

const getCallsStatus = async (
    callId: string,
): Promise<GetCallsStatusResponse> => {
    return await requestAlchemy<GetCallsStatusResponse>(
        "wallet_getCallsStatus",
        [callId],
    );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const prefixHex = (data: string) =>
    data.startsWith("0x") ? data : `0x${data}`;

export const sendTransaction = async (
    signer: Wallet,
    chainId: bigint,
    calls: AlchemyCall[],
): Promise<string> => {
    calls = calls.map((call) => ({
        to: call.to,
        value: call.value ? toBeHex(call.value) : undefined,
        data: call.data ? prefixHex(call.data) : undefined,
    }));

    const signerAddress = await signer.getAddress();
    const prepared = await prepareCalls(
        signerAddress,
        `0x${chainId.toString(16)}`,
        calls,
    );
    const signed = await signPreparedCalls(signer, prepared);
    const callId = await sendPreparedCalls(signed);
    return await waitForTransactionHash(callId);
};

const waitForTransactionHash = async (
    callId: string,
    intervalMs = 1_000,
    maxAttempts = 60,
): Promise<string> => {
    for (let i = 0; i < maxAttempts; i++) {
        const status = await getCallsStatus(callId);

        if (
            status.result.receipts !== undefined &&
            status.result.receipts.length > 0
        ) {
            return status.result.receipts[0].transactionHash;
        }

        await sleep(intervalMs);
    }

    throw new Error(`Transaction not confirmed after ${maxAttempts} attempts`);
};
