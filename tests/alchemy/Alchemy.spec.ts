import {
    type TransactionRequest,
    createPublicClient,
    createWalletClient,
    custom,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { sendTransaction, toAlchemyCall } from "../../src/alchemy/Alchemy";
import type { Signer } from "../../src/context/Web3";

describe("Alchemy", () => {
    type JsonRpcRequest = {
        method: string;
        params?: unknown[];
    };
    type SendPreparedRequest = JsonRpcRequest & {
        params: [
            {
                type: "array";
                data: {
                    signature: { data: string };
                }[];
            },
        ];
    };
    type PrepareRequest = JsonRpcRequest & {
        params: [
            {
                calls: { data?: string; value?: string }[];
            },
        ];
    };

    const parseRequestBody = <T extends JsonRpcRequest = JsonRpcRequest>(
        init: RequestInit | undefined,
    ): T => {
        if (typeof init?.body !== "string") {
            throw new Error("expected JSON-RPC request body");
        }
        return JSON.parse(init.body) as T;
    };

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    describe("toAlchemyCall", () => {
        test("should convert populated transaction fields to an Alchemy call", () => {
            const transaction: TransactionRequest = {
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
                value: 5n,
            };

            expect(toAlchemyCall(transaction)).toEqual({
                to: "0x1000000000000000000000000000000000000000",
                data: "0x1234",
                value: "5",
            });
        });

        test("should throw when the transaction destination address is missing", () => {
            const transaction: TransactionRequest = {
                data: "0x1234",
            };

            expect(() => toAlchemyCall(transaction)).toThrow(
                "transaction is missing destination address",
            );
        });
    });

    describe("sendTransaction", () => {
        test("should sign prepared calls in the order Alchemy expects", async () => {
            const privateKey =
                "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                transport: custom({
                    request: () =>
                        Promise.reject(
                            new Error("unexpected wallet rpc request"),
                        ),
                }),
            });
            const signer = Object.assign(walletClient, {
                address: account.address,
                provider: createPublicClient({
                    transport: custom({
                        request: () =>
                            Promise.reject(
                                new Error("unexpected public rpc request"),
                            ),
                    }),
                }),
                rdns: "test",
            });
            const authPayload =
                "0x2a8073568c8fad3edf15f70c3471a7fff18e1d57c650a501ab47f57a5c1f0e39";
            const userOperationPayload =
                "0xc69e468aa6fafb5c7298c02841e76f976b433018266af39a5807bc29ea9ad392";
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockImplementation((_url, init) => {
                    const body = parseRequestBody(init);

                    switch (body.method) {
                        case "wallet_prepareCalls":
                            return Promise.resolve(
                                Response.json({
                                    id: 1,
                                    jsonrpc: "2.0",
                                    result: {
                                        type: "array",
                                        data: [
                                            {
                                                type: "eip-7702-authorization",
                                                data: { authorization: true },
                                                chainId: "0x1e",
                                                signatureRequest: {
                                                    rawPayload: authPayload,
                                                },
                                            },
                                            {
                                                type: "user-operation-v070",
                                                data: { userOperation: true },
                                                chainId: "0x1e",
                                                signatureRequest: {
                                                    data: {
                                                        raw: userOperationPayload,
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                }),
                            );

                        case "wallet_sendPreparedCalls":
                            return Promise.resolve(
                                Response.json({
                                    id: 1,
                                    jsonrpc: "2.0",
                                    result: { preparedCallIds: ["call-id"] },
                                }),
                            );

                        case "wallet_getCallsStatus":
                            return Promise.resolve(
                                Response.json({
                                    id: 1,
                                    jsonrpc: "2.0",
                                    result: {
                                        status: 200,
                                        receipts: [
                                            {
                                                transactionHash: "0xsent",
                                                status: "confirmed",
                                                blockHash: "0xblock",
                                                blockNumber: "0x1",
                                                gasUsed: "0x1",
                                            },
                                        ],
                                    },
                                }),
                            );

                        default:
                            throw new Error(`unexpected method ${body.method}`);
                    }
                });

            await expect(
                sendTransaction(signer, 30n, [
                    {
                        to: "0x1000000000000000000000000000000000000000",
                        data: "0x1234",
                        value: "1",
                    },
                ]),
            ).resolves.toEqual("0xsent");

            const sendPreparedRequest = fetchMock.mock.calls
                .map(([, init]) => parseRequestBody<SendPreparedRequest>(init))
                .find(
                    (body: { method: string }) =>
                        body.method === "wallet_sendPreparedCalls",
                );
            const prepareRequest = fetchMock.mock.calls
                .map(([, init]) => parseRequestBody<PrepareRequest>(init))
                .find(
                    (body: { method: string }) =>
                        body.method === "wallet_prepareCalls",
                );

            if (
                sendPreparedRequest === undefined ||
                prepareRequest === undefined
            ) {
                throw new Error("expected Alchemy prepare and send requests");
            }

            expect(prepareRequest.params[0].calls[0]).toMatchObject({
                data: "0x1234",
                value: "0x1",
            });
            expect(sendPreparedRequest.params[0].data[0].signature.data).toBe(
                "0x61b98893a026d4be727a1cd31a89adc9ae6cad6e33aeb69f70c490d7275db9464cc4c3e5cb3001fa83d2c877444a297b0bd00822419d0160b45c7a4da939d0481b",
            );
            expect(sendPreparedRequest.params[0].data[1].signature.data).toBe(
                "0xe6af5df65812fefa12eda3f2e79bd950312bd47d0d8c68c4986868888692e5c031af41b1cdac59152c2187061e30e9137cd2d3b58dbdc64dc703e2af4d537d421b",
            );
        });

        type SinglePreparedRequest = JsonRpcRequest & {
            params: [
                {
                    type: string;
                    signature: { type: string; data: string };
                },
            ];
        };

        test("should EIP-191 sign subsequent user operations (single non-array result)", async () => {
            const privateKey =
                "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            const account = privateKeyToAccount(privateKey);
            const walletClient = createWalletClient({
                account,
                transport: custom({
                    request: () =>
                        Promise.reject(
                            new Error("unexpected wallet rpc request"),
                        ),
                }),
            });
            const signer = Object.assign(walletClient, {
                address: account.address,
                provider: createPublicClient({
                    transport: custom({
                        request: () =>
                            Promise.reject(
                                new Error("unexpected public rpc request"),
                            ),
                    }),
                }),
                rdns: "test",
            });
            // Same payload as Path A — confirms both paths sign identically.
            const userOperationPayload =
                "0xc69e468aa6fafb5c7298c02841e76f976b433018266af39a5807bc29ea9ad392";

            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockImplementation((_url, init) => {
                    const body = parseRequestBody(init);

                    switch (body.method) {
                        case "wallet_prepareCalls":
                            return Promise.resolve(
                                Response.json({
                                    id: 1,
                                    jsonrpc: "2.0",
                                    result: {
                                        type: "user-operation-v070",
                                        data: { userOperation: true },
                                        chainId: "0x1e",
                                        signatureRequest: {
                                            data: { raw: userOperationPayload },
                                        },
                                    },
                                }),
                            );

                        case "wallet_sendPreparedCalls":
                            return Promise.resolve(
                                Response.json({
                                    id: 1,
                                    jsonrpc: "2.0",
                                    result: { preparedCallIds: ["call-id"] },
                                }),
                            );

                        case "wallet_getCallsStatus":
                            return Promise.resolve(
                                Response.json({
                                    id: 1,
                                    jsonrpc: "2.0",
                                    result: {
                                        status: 200,
                                        receipts: [
                                            {
                                                transactionHash: "0xsubsequent",
                                                status: "confirmed",
                                                blockHash: "0xblock",
                                                blockNumber: "0x2",
                                                gasUsed: "0x1",
                                            },
                                        ],
                                    },
                                }),
                            );

                        default:
                            throw new Error(`unexpected method ${body.method}`);
                    }
                });

            await expect(
                sendTransaction(signer, 30n, [
                    {
                        to: "0x1000000000000000000000000000000000000000",
                        data: "0x1234",
                    },
                ]),
            ).resolves.toEqual("0xsubsequent");

            const sendPreparedRequest = fetchMock.mock.calls
                .map(([, init]) =>
                    parseRequestBody<SinglePreparedRequest>(init),
                )
                .find(
                    (body: { method: string }) =>
                        body.method === "wallet_sendPreparedCalls",
                );
            if (sendPreparedRequest === undefined) {
                throw new Error("expected wallet_sendPreparedCalls request");
            }
            // Path B sends the signature unwrapped (no { type: "array", data } envelope).
            expect(sendPreparedRequest.params[0].type).toBe(
                "user-operation-v070",
            );
            expect(sendPreparedRequest.params[0].signature).toEqual({
                type: "secp256k1",
                data: "0xe6af5df65812fefa12eda3f2e79bd950312bd47d0d8c68c4986868888692e5c031af41b1cdac59152c2187061e30e9137cd2d3b58dbdc64dc703e2af4d537d421b",
            });
        });

        test("should reject 7702 authorization signing for non-local signers", async () => {
            // JSON-RPC signers must not sign raw 32-byte digests (no EIP-191 prefix).
            const jsonRpcSigner = {
                account: {
                    type: "json-rpc",
                    address: "0x1111111111111111111111111111111111111111",
                },
                address: "0x1111111111111111111111111111111111111111",
                signMessage: vi.fn(),
                provider: createPublicClient({
                    transport: custom({
                        request: () => Promise.reject(new Error("unused")),
                    }),
                }),
                rdns: "metamask",
            } as unknown as Signer;

            vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_prepareCalls") {
                    throw new Error(
                        `unexpected method ${body.method} — gate should fire before this`,
                    );
                }
                return Promise.resolve(
                    Response.json({
                        id: 1,
                        jsonrpc: "2.0",
                        result: {
                            type: "array",
                            data: [
                                {
                                    type: "eip-7702-authorization",
                                    data: { authorization: true },
                                    chainId: "0x1e",
                                    signatureRequest: {
                                        rawPayload: `0x${"00".repeat(32)}`,
                                    },
                                },
                                {
                                    type: "user-operation-v070",
                                    data: { userOperation: true },
                                    chainId: "0x1e",
                                    signatureRequest: {
                                        data: { raw: `0x${"00".repeat(32)}` },
                                    },
                                },
                            ],
                        },
                    }),
                );
            });

            await expect(
                sendTransaction(jsonRpcSigner, 30n, [
                    {
                        to: "0x1000000000000000000000000000000000000000",
                        data: "0x1234",
                    },
                ]),
            ).rejects.toThrow(
                "Alchemy authorization signing requires a local signer",
            );
        });
    });
});
