import { type Wallet, getBytes } from "ethers";

const getAlchemyApiKey = (): string => {
    const key = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined;
    if (key === undefined) {
        throw new Error("VITE_ALCHEMY_API_KEY is not defined");
    }
    return key;
};

const alchemyUrl = `https://api.g.alchemy.com/v2/${getAlchemyApiKey()}`;

const getAlchemyGasPolicyId = (): string => {
    const id = import.meta.env.VITE_ALCHEMY_GAS_POLICY_ID as string | undefined;
    if (id === undefined) {
        throw new Error("VITE_ALCHEMY_GAS_POLICY_ID is not defined");
    }
    return id;
};

export const prepareCalls = async (
    signerAddress: string,
    chainId: string,
    calls: { to: string; data?: string; value?: string }[],
) => {
    const response = await fetch(alchemyUrl, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "wallet_prepareCalls",
            params: [
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
            ],
        }),
    });

    return (await response.json()) as PrepareCallsResponse;
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

type PrepareCallsResponse = {
    id: number;
    jsonrpc: string;
    result: PrepareCallsResult;
};

type SignedEntry = {
    type: string;
    data: unknown;
    chainId: string;
    signature: { type: string; data: string };
};

type SendPreparedCallsResponse = {
    id: number;
    jsonrpc: string;
    result: {
        preparedCallIds: string[];
    };
};

type CallsStatusReceipt = {
    transactionHash: string;
    status: string;
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
};

type GetCallsStatusResponse = {
    id: number;
    jsonrpc: string;
    result: {
        status: number;
        receipts?: CallsStatusReceipt[];
    };
};

export const signPreparedCalls = async (
    signer: Wallet,
    prepareCallsResponse: PrepareCallsResponse,
): Promise<SignedEntry[] | SignedEntry> => {
    const { result } = prepareCallsResponse;

    if (result.type === "array") {
        const entries = result.data as PrepareCallsEntry[];

        // Sign the 7702 authorization as a raw digest (no EIP-191 prefix)
        const authPayload = entries[0].signatureRequest.rawPayload;
        const authSignature = signer.signingKey.sign(authPayload).serialized;

        // Sign the user operation
        const uoPayload = entries[1].signatureRequest.data.raw;
        const uoSignature = await signer.signMessage(getBytes(uoPayload));

        return [
            {
                type: entries[0].type,
                data: entries[0].data,
                chainId: entries[0].chainId,
                signature: { type: "secp256k1", data: authSignature },
            },
            {
                type: entries[1].type,
                data: entries[1].data,
                chainId: entries[1].chainId,
                signature: { type: "secp256k1", data: uoSignature },
            },
        ];
    }

    // Subsequent transactions: sign only the user operation
    const payload = result.signatureRequest.data.raw;
    const signature = await signer.signMessage(getBytes(payload));

    return {
        type: result.type,
        data: result.data,
        chainId: result.chainId,
        signature: { type: "secp256k1", data: signature },
    };
};

export const sendPreparedCalls = async (
    signedData: SignedEntry[] | SignedEntry,
): Promise<string> => {
    const params = Array.isArray(signedData)
        ? [{ type: "array", data: signedData }]
        : [signedData];

    const response = await fetch(alchemyUrl, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "wallet_sendPreparedCalls",
            params,
        }),
    });

    const result = (await response.json()) as SendPreparedCallsResponse;
    return result.result.preparedCallIds[0];
};

const getCallsStatus = async (
    callId: string,
): Promise<GetCallsStatusResponse> => {
    const response = await fetch(alchemyUrl, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "wallet_getCallsStatus",
            params: [callId],
        }),
    });

    return (await response.json()) as GetCallsStatusResponse;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendTransaction = async (
    signer: Wallet,
    chainId: bigint,
    calls: { to: string; data?: string; value?: string }[],
): Promise<string> => {
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

export const waitForTransactionHash = async (
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
