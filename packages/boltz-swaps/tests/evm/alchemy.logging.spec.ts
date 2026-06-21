import { createPublicClient, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
    sendAlchemyTransaction,
    waitForPreparedCallTransactionHash,
} from "../../src/evm/alchemy.ts";
import type { Signer } from "../../src/interfaces/signer.ts";
import { type Logger, setLogger } from "../../src/logger.ts";

describe("Alchemy logging / error branches", () => {
    type JsonRpcRequest = {
        method: string;
        params?: unknown[];
    };

    const parseRequestBody = <T extends JsonRpcRequest = JsonRpcRequest>(
        init: RequestInit | undefined,
    ): T => {
        if (typeof init?.body !== "string") {
            throw new Error("expected JSON-RPC request body");
        }
        return JSON.parse(init.body) as T;
    };

    const noopLogger: Logger = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        log: () => {},
    };

    let logger: {
        trace: ReturnType<typeof vi.fn>;
        debug: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
        warn: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        log: ReturnType<typeof vi.fn>;
    };

    const makeLocalSigner = (): Signer => {
        const privateKey =
            "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const account = privateKeyToAccount(privateKey);
        const walletClient = createWalletClient({
            account,
            transport: custom({
                request: () =>
                    Promise.reject(new Error("unexpected wallet rpc request")),
            }),
        });
        return Object.assign(walletClient, {
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
        }) as Signer;
    };

    const prepareArrayResult = () =>
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
                            rawPayload:
                                "0x2a8073568c8fad3edf15f70c3471a7fff18e1d57c650a501ab47f57a5c1f0e39",
                        },
                    },
                    {
                        type: "user-operation-v070",
                        data: { userOperation: true },
                        chainId: "0x1e",
                        signatureRequest: {
                            data: {
                                raw: "0xc69e468aa6fafb5c7298c02841e76f976b433018266af39a5807bc29ea9ad392",
                            },
                        },
                    },
                ],
            },
        });

    const sendPreparedResult = (callId = "call-id") =>
        Response.json({
            id: 1,
            jsonrpc: "2.0",
            result: { preparedCallIds: [callId] },
        });

    const statusWithReceipt = (transactionHash = "0xok") =>
        Response.json({
            id: 1,
            jsonrpc: "2.0",
            result: {
                status: 200,
                receipts: [
                    {
                        transactionHash,
                        status: "confirmed",
                        blockHash: "0xblock",
                        blockNumber: "0x1",
                        gasUsed: "0x1",
                    },
                ],
            },
        });

    const statusWithoutReceipts = () =>
        Response.json({
            id: 1,
            jsonrpc: "2.0",
            result: { status: 200, receipts: [] },
        });

    const baseCall = {
        to: "0x1000000000000000000000000000000000000000" as const,
        data: "0x1234" as const,
        value: "1" as const,
    };

    beforeEach(() => {
        logger = {
            trace: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            log: vi.fn(),
        };
        setLogger(logger as unknown as Logger);
    });

    afterEach(() => {
        setLogger(noopLogger);
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("requestAlchemy error / timeout branches", () => {
        test("logs and throws on request timeout (AbortController fires after 60000ms)", async () => {
            vi.useFakeTimers();

            let requestSignal: AbortSignal | undefined;
            const fetchMock = vi.fn(
                (_url: string, init: RequestInit = {}) =>
                    new Promise<Response>((_resolve, reject) => {
                        requestSignal = init.signal as AbortSignal;
                        requestSignal.addEventListener(
                            "abort",
                            () => reject(requestSignal?.reason),
                            { once: true },
                        );
                    }),
            );
            vi.stubGlobal("fetch", fetchMock);

            const request = sendAlchemyTransaction(makeLocalSigner(), 30n, [
                baseCall,
            ]);
            const rejection = expect(request).rejects.toThrow(
                /Alchemy request timed out for wallet_prepareCalls after 60000ms/,
            );

            await vi.advanceTimersByTimeAsync(60_000);
            await rejection;

            expect(requestSignal?.aborted).toBe(true);
            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy wallet_prepareCalls timed out after 60000ms",
                expect.anything(),
            );
            expect(logger.error).not.toHaveBeenCalledWith(
                "Alchemy wallet_prepareCalls fetch failed",
                expect.anything(),
            );
        });

        test("logs and throws on a generic (non-abort) fetch failure", async () => {
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockImplementation((_url, init) => {
                    const body = parseRequestBody(init);
                    if (body.method === "wallet_prepareCalls") {
                        return Promise.reject(new Error("econnreset"));
                    }
                    throw new Error(`unexpected method ${body.method}`);
                });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).rejects.toThrow(
                "Alchemy request failed for wallet_prepareCalls: econnreset",
            );

            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy wallet_prepareCalls fetch failed",
                expect.any(Error),
            );
            expect(logger.error).not.toHaveBeenCalledWith(
                expect.stringContaining("timed out after"),
                expect.anything(),
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        test("throws invalid-JSON error when the body is not valid JSON", async () => {
            vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
                const body = parseRequestBody(init);
                if (body.method === "wallet_prepareCalls") {
                    return Promise.resolve(
                        new Response("not-json", {
                            status: 200,
                            statusText: "OK",
                        }),
                    );
                }
                throw new Error(`unexpected method ${body.method}`);
            });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).rejects.toThrow(
                "Alchemy returned invalid JSON for wallet_prepareCalls (HTTP 200 OK)",
            );

            expect(logger.error).not.toHaveBeenCalled();
        });

        test("logs and throws on non-ok HTTP WITH payload.error", async () => {
            const rpcError = { code: -32000, message: "bad" };
            vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
                const body = parseRequestBody(init);
                if (body.method === "wallet_prepareCalls") {
                    return Promise.resolve(
                        Response.json(
                            { id: 1, jsonrpc: "2.0", error: rpcError },
                            { status: 500, statusText: "Server Error" },
                        ),
                    );
                }
                throw new Error(`unexpected method ${body.method}`);
            });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).rejects.toThrow(
                "Alchemy HTTP error for wallet_prepareCalls: 500 Server Error (-32000 bad)",
            );

            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy wallet_prepareCalls HTTP 500 Server Error",
                rpcError,
            );
        });

        test("logs and throws on non-ok HTTP WITHOUT payload.error using truncated body", async () => {
            const padding = "p".repeat(600);
            const bodyObject = { id: 1, jsonrpc: "2.0", padding };
            const rawBody = JSON.stringify(bodyObject);
            const expectedTruncated = `${rawBody.slice(0, 500)}…(${rawBody.length} bytes)`;

            vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
                const body = parseRequestBody(init);
                if (body.method === "wallet_prepareCalls") {
                    return Promise.resolve(
                        new Response(rawBody, {
                            status: 502,
                            statusText: "Bad Gateway",
                            headers: { "content-type": "application/json" },
                        }),
                    );
                }
                throw new Error(`unexpected method ${body.method}`);
            });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).rejects.toThrow(
                `Alchemy HTTP error for wallet_prepareCalls: 502 Bad Gateway (${expectedTruncated})`,
            );

            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy wallet_prepareCalls HTTP 502 Bad Gateway",
                expectedTruncated,
            );
            expect(
                expectedTruncated.endsWith(`…(${rawBody.length} bytes)`),
            ).toBe(true);
        });

        test("logs and throws on a JSON-RPC error (HTTP 200, payload.error set)", async () => {
            const rpcError = { code: -32601, message: "method not found" };
            vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
                const body = parseRequestBody(init);
                if (body.method === "wallet_prepareCalls") {
                    return Promise.resolve(
                        Response.json({
                            id: 1,
                            jsonrpc: "2.0",
                            error: rpcError,
                        }),
                    );
                }
                throw new Error(`unexpected method ${body.method}`);
            });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).rejects.toThrow(
                "Alchemy RPC error for wallet_prepareCalls: -32601 method not found",
            );

            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy wallet_prepareCalls RPC error",
                rpcError,
            );
        });

        test("logs and throws on a response missing the result field", async () => {
            vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
                const body = parseRequestBody(init);
                if (body.method === "wallet_prepareCalls") {
                    return Promise.resolve(
                        Response.json({ id: 1, jsonrpc: "2.0" }),
                    );
                }
                throw new Error(`unexpected method ${body.method}`);
            });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).rejects.toThrow(
                "Alchemy response for wallet_prepareCalls is missing result",
            );

            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Alchemy wallet_prepareCalls response missing result",
                ),
            );
        });
    });

    describe("waitForTransactionHash polling branches", () => {
        test("recovers after a prior failure: warn once, info recovery, debug confirm", async () => {
            vi.useFakeTimers();

            let statusPoll = 0;
            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_getCallsStatus") {
                    throw new Error(`unexpected method ${body.method}`);
                }
                statusPoll += 1;
                if (statusPoll === 1) {
                    return Promise.reject(new Error("transient"));
                }
                return Promise.resolve(statusWithReceipt("0xok"));
            });
            vi.stubGlobal("fetch", fetchMock);

            const promise = sendAlchemyTransaction(makeLocalSigner(), 30n, [], {
                existingCallId: "call-1",
            });
            const resolution = expect(promise).resolves.toBe("0xok");

            await vi.advanceTimersByTimeAsync(1_000);
            await vi.advanceTimersByTimeAsync(1_000);
            await resolution;

            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledWith(
                "Alchemy getCallsStatus failed for call call-1 (attempt 1/60, 1 consecutive)",
                expect.any(Error),
            );
            expect(logger.info).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith(
                "Alchemy getCallsStatus recovered for call call-1 after 1 consecutive failure(s)",
            );
            expect(logger.debug).toHaveBeenCalledWith(
                "Alchemy call call-1 confirmed after 2 poll(s): 0xok",
            );
        });

        test("debug-logs the confirm poll count: empty receipts then a receipt → confirmed after 2 poll(s)", async () => {
            vi.useFakeTimers();

            let statusPoll = 0;
            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_getCallsStatus") {
                    throw new Error(`unexpected method ${body.method}`);
                }
                statusPoll += 1;
                if (statusPoll === 1) {
                    return Promise.resolve(statusWithoutReceipts());
                }
                return Promise.resolve(statusWithReceipt("0xsent"));
            });
            vi.stubGlobal("fetch", fetchMock);

            const promise = sendAlchemyTransaction(makeLocalSigner(), 30n, [], {
                existingCallId: "call-2",
            });
            const resolution = expect(promise).resolves.toBe("0xsent");

            await vi.advanceTimersByTimeAsync(1_000);
            await vi.advanceTimersByTimeAsync(1_000);
            await resolution;

            expect(logger.debug).toHaveBeenCalledWith(
                "Alchemy call call-2 confirmed after 2 poll(s): 0xsent",
            );
            expect(logger.warn).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        });

        test("warn throttling: warns only on consecutive failures 1 and 10", async () => {
            vi.useFakeTimers();

            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_getCallsStatus") {
                    throw new Error(`unexpected method ${body.method}`);
                }
                return Promise.reject(new Error("always down"));
            });
            vi.stubGlobal("fetch", fetchMock);

            const promise = waitForPreparedCallTransactionHash("call-3");
            const rejection = expect(promise).rejects.toThrow();

            for (let i = 0; i < 10; i++) {
                await vi.advanceTimersByTimeAsync(1_000);
            }

            expect(logger.warn).toHaveBeenCalledTimes(2);
            expect(logger.warn).toHaveBeenNthCalledWith(
                1,
                "Alchemy getCallsStatus failed for call call-3 (attempt 1/60, 1 consecutive)",
                expect.any(Error),
            );
            expect(logger.warn).toHaveBeenNthCalledWith(
                2,
                "Alchemy getCallsStatus failed for call call-3 (attempt 10/60, 10 consecutive)",
                expect.any(Error),
            );

            await vi.runAllTimersAsync();
            await rejection;
        });

        test("terminal error WITH lastStatusError: every poll rejects → status unavailable", async () => {
            vi.useFakeTimers();

            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_getCallsStatus") {
                    throw new Error(`unexpected method ${body.method}`);
                }
                return Promise.reject(new Error("rpc down"));
            });
            vi.stubGlobal("fetch", fetchMock);

            const promise = waitForPreparedCallTransactionHash("call-x");
            const rejection = expect(promise).rejects.toThrow(
                /^Alchemy call call-x status unavailable after 60 attempts:.*rpc down$/,
            );

            await vi.runAllTimersAsync();
            await rejection;

            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy call call-x status unavailable after 60 attempts",
                expect.any(Error),
            );
        });

        test("terminal error WITHOUT lastStatusError: polls succeed but never return receipts → not confirmed", async () => {
            vi.useFakeTimers();

            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_getCallsStatus") {
                    throw new Error(`unexpected method ${body.method}`);
                }
                return Promise.resolve(statusWithoutReceipts());
            });
            vi.stubGlobal("fetch", fetchMock);

            const promise = sendAlchemyTransaction(makeLocalSigner(), 30n, [], {
                existingCallId: "call-empty",
            });
            const rejection = expect(promise).rejects.toThrow(
                "Alchemy call call-empty not confirmed after 60 attempts",
            );

            await vi.runAllTimersAsync();
            await rejection;

            expect(logger.error).toHaveBeenCalledWith(
                "Alchemy call call-empty not confirmed after 60 polls (no receipts returned)",
            );
            expect(logger.warn).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalled();
        });
    });

    describe("sendAlchemyTransaction options", () => {
        test("existingCallId short-circuits prepare/sign/send and only polls status", async () => {
            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                if (body.method !== "wallet_getCallsStatus") {
                    throw new Error(
                        `unexpected method ${body.method} — short-circuit failed`,
                    );
                }
                return Promise.resolve(statusWithReceipt("0xresume"));
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall], {
                    existingCallId: "resume-1",
                }),
            ).resolves.toBe("0xresume");

            const methods = fetchMock.mock.calls.map(
                ([, init]) => parseRequestBody(init).method,
            );
            expect(methods).toEqual(["wallet_getCallsStatus"]);
            expect(methods).not.toContain("wallet_prepareCalls");
            expect(methods).not.toContain("wallet_sendPreparedCalls");

            const statusBody = parseRequestBody(fetchMock.mock.calls[0][1]);
            expect(statusBody.params).toEqual(["resume-1"]);
        });

        test("onPreparedCallId callback is awaited once with the callId before resolving", async () => {
            const callOrder: string[] = [];

            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                switch (body.method) {
                    case "wallet_prepareCalls":
                        return Promise.resolve(prepareArrayResult());
                    case "wallet_sendPreparedCalls":
                        return Promise.resolve(sendPreparedResult("call-id"));
                    case "wallet_getCallsStatus":
                        callOrder.push("getCallsStatus");
                        return Promise.resolve(statusWithReceipt("0xsent"));
                    default:
                        throw new Error(`unexpected method ${body.method}`);
                }
            });
            vi.stubGlobal("fetch", fetchMock);

            const onPreparedCallId = vi.fn(async (id: string) => {
                callOrder.push(`onPreparedCallId:${id}`);
            });

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall], {
                    onPreparedCallId,
                }),
            ).resolves.toBe("0xsent");

            expect(onPreparedCallId).toHaveBeenCalledTimes(1);
            expect(onPreparedCallId).toHaveBeenCalledWith("call-id");
            expect(callOrder).toEqual([
                "onPreparedCallId:call-id",
                "getCallsStatus",
            ]);
        });

        test("omitting onPreparedCallId does not throw (optional-chain no-op)", async () => {
            const fetchMock = vi.fn((_url: string, init: RequestInit = {}) => {
                const body = parseRequestBody(init);
                switch (body.method) {
                    case "wallet_prepareCalls":
                        return Promise.resolve(prepareArrayResult());
                    case "wallet_sendPreparedCalls":
                        return Promise.resolve(sendPreparedResult("call-id"));
                    case "wallet_getCallsStatus":
                        return Promise.resolve(statusWithReceipt("0xsent"));
                    default:
                        throw new Error(`unexpected method ${body.method}`);
                }
            });
            vi.stubGlobal("fetch", fetchMock);

            await expect(
                sendAlchemyTransaction(makeLocalSigner(), 30n, [baseCall]),
            ).resolves.toBe("0xsent");
        });
    });
});
