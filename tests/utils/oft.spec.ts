// @vitest-environment node
import { base58, hex } from "@scure/base";

import { config as runtimeConfig } from "../../src/config";
import { NetworkTransport } from "../../src/configs/base";
import { config as mainnetConfig } from "../../src/configs/mainnet";

const {
    decodeExecutorNativeAmountExceedsCapError,
    getOftReceivedEventByGuid,
    isExecutorNativeAmountExceedsCapError,
    quoteOftAmountInForAmountOut,
    quoteOftSend,
    clearOftDeployments,
} = await import("../../src/utils/oft/oft");
const { getOftContract } = await import("../../src/utils/oft/registry");
const { getSolanaOftGuidFromLogs: getSolanaOftSentEventFromTransaction } =
    await import("../../src/utils/oft/solana");
const { shouldCreateSolanaTokenAccount } =
    await import("../../src/utils/chains/solana");

const getOftRoute = (from: string, to = from) => ({
    sourceAsset: from,
    destinationAsset: to,
});

const validSolanaRecipient = "BZkwksSEeHrCVS3HeewBJKEBTEEuwnEqpkHqEg1dRpuE";
const solanaOftProgramContract = {
    name: "OFT Program",
    address: "Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7",
    explorer: "",
};
const solanaOftStoreContract = {
    name: "OFT Store",
    address: "HyXJcgYpURfDhgzuyRL7zxP4FhLg7LZQMeDrR4MXZcMN",
    explorer: "",
};
const createSolanaLegacyMeshDeployment = (
    contracts = [solanaOftProgramContract],
) => ({
    name: "Solana",
    lzEid: "30168",
    contracts,
});
const createOkFetchResponse = (json: unknown) => ({
    ok: true,
    json: vi.fn().mockResolvedValue(json),
});
const createFetchWithDeployments = (
    deployments: unknown,
    rpcFetchSpy: () => Promise<unknown>,
) =>
    vi.fn().mockImplementation((input: string) => {
        if (input === "https://docs.usdt0.to/api/deployments") {
            return Promise.resolve(createOkFetchResponse(deployments));
        }

        return rpcFetchSpy();
    });

const originalAssets = structuredClone(runtimeConfig.assets ?? {});
const originalNetwork = runtimeConfig.network;

describe("oft", () => {
    beforeAll(() => {
        runtimeConfig.assets = structuredClone(mainnetConfig.assets);
        runtimeConfig.network = mainnetConfig.network;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        clearOftDeployments();
    });

    afterAll(() => {
        runtimeConfig.assets = originalAssets;
        runtimeConfig.network = originalNetwork;
    });

    test("should include native drop options in OFT send params", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [
                            {
                                name: "Ethereum",
                                chainId: 1,
                                lzEid: "30101",
                                contracts: [
                                    {
                                        name: "OFT Adapter",
                                        address:
                                            "0x1000000000000000000000000000000000000001",
                                        explorer: "",
                                    },
                                ],
                            },
                            {
                                name: "Polygon PoS",
                                chainId: 137,
                                lzEid: "30109",
                                contracts: [
                                    {
                                        name: "OFT",
                                        address:
                                            "0x1000000000000000000000000000000000000000",
                                        explorer: "",
                                    },
                                ],
                            },
                        ],
                        legacyMesh: [],
                    },
                }),
            }),
        );

        const oft = {
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
        };

        const { sendParam, msgFee } = await quoteOftSend(
            oft as never,
            getOftRoute("USDT0-ETH", "USDT0-POL"),
            "0x2000000000000000000000000000000000000000",
            100n,
            {
                nativeDrop: {
                    amount: 7n,
                    receiver: "0x3000000000000000000000000000000000000000",
                },
            },
        );

        expect(sendParam[4]).not.toBe("0x");
        expect(sendParam[4].startsWith("0x0003")).toBe(true);
        expect(oft.quoteOFT).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.any(Number),
                expect.any(String),
                100n,
                0n,
                sendParam[4],
            ]),
        );
        expect(msgFee).toEqual([5n, 0n]);

        await expect(getOftContract(getOftRoute("USDT0-ETH"))).resolves.toEqual(
            {
                name: "OFT Adapter",
                address: "0x1000000000000000000000000000000000000001",
                explorer: "",
            },
        );
    });

    test("should normalize quoteSend fee tuples into a mutable array", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [
                            {
                                name: "Ethereum",
                                chainId: 1,
                                lzEid: "30101",
                                contracts: [
                                    {
                                        name: "OFT Adapter",
                                        address:
                                            "0x1000000000000000000000000000000000000001",
                                        explorer: "",
                                    },
                                ],
                            },
                            {
                                name: "Polygon PoS",
                                chainId: 137,
                                lzEid: "30109",
                                contracts: [
                                    {
                                        name: "OFT",
                                        address:
                                            "0x1000000000000000000000000000000000000000",
                                        explorer: "",
                                    },
                                ],
                            },
                        ],
                        legacyMesh: [],
                    },
                }),
            }),
        );

        const oft = {
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi
                .fn()
                .mockResolvedValue(Object.freeze([5n, 0n]) as [bigint, bigint]),
        };

        const { msgFee } = await quoteOftSend(
            oft as never,
            getOftRoute("USDT0-ETH", "USDT0-POL"),
            "0x2000000000000000000000000000000000000000",
            100n,
        );

        expect(msgFee).toEqual([5n, 0n]);
        expect(Object.isFrozen(msgFee)).toBe(false);

        msgFee[0] = 6n;
        expect(msgFee[0]).toBe(6n);
    });

    test("should resolve legacy mesh assets by configured endpoint id", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [],
                        legacyMesh: [
                            {
                                name: "Tron",
                                lzEid: "30420",
                                contracts: [
                                    {
                                        name: "OFT",
                                        address:
                                            "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt",
                                        explorer: "",
                                    },
                                ],
                            },
                        ],
                    },
                }),
            }),
        );

        await expect(
            getOftContract(getOftRoute("USDT0-TRON")),
        ).resolves.toEqual({
            name: "OFT",
            address: "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt",
            explorer: "",
        });
    });

    test("should calculate legacy mesh amount in locally", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        await expect(
            quoteOftAmountInForAmountOut(
                getOftRoute("USDT0-ETH", "USDT0-SOL"),
                1_000_000_000n,
            ),
        ).resolves.toEqual(1_000_300_091n);

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("should throw when a route has no OFT contract", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [
                            {
                                name: "Ethereum",
                                chainId: 1,
                                lzEid: "30101",
                                contracts: [
                                    {
                                        name: "OFT Store",
                                        address:
                                            "0x1000000000000000000000000000000000000001",
                                        explorer: "",
                                    },
                                ],
                            },
                        ],
                        legacyMesh: [],
                    },
                }),
            }),
        );

        await expect(getOftContract(getOftRoute("USDT0-ETH"))).rejects.toThrow(
            "Missing OFT contract for route USDT0-ETH -> USDT0-ETH and OFT usdt0",
        );
    });

    test("should encode Solana recipients as 32-byte public keys", async () => {
        const rpcFetchSpy = vi
            .fn()
            .mockResolvedValue(
                createOkFetchResponse({ result: { value: {} } }),
            );
        vi.stubGlobal(
            "fetch",
            createFetchWithDeployments(
                {
                    usdt0: {
                        native: [],
                        legacyMesh: [
                            createSolanaLegacyMeshDeployment([
                                solanaOftStoreContract,
                                solanaOftProgramContract,
                            ]),
                        ],
                    },
                },
                rpcFetchSpy,
            ),
        );

        await expect(getOftContract(getOftRoute("USDT0-SOL"))).resolves.toEqual(
            solanaOftProgramContract,
        );

        const oft = {
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
            send: vi.fn(),
        };
        const recipient = validSolanaRecipient;

        const { sendParam } = await quoteOftSend(
            oft as never,
            getOftRoute("USDT0", "USDT0-SOL"),
            recipient,
            100n,
        );

        expect(sendParam[1]).toEqual(
            `0x${hex.encode(base58.decode(recipient))}`,
        );
    });

    test("should skip token account checks for non-Solana assets", async () => {
        await expect(
            shouldCreateSolanaTokenAccount("USDT0-ETH", validSolanaRecipient),
        ).resolves.toBe(false);
    });

    test("should not cache positive Solana ATA creation checks per recipient", async () => {
        runtimeConfig.assets = {
            ...runtimeConfig.assets,
            "TEST-SOL": {
                network: {
                    transport: NetworkTransport.Solana,
                    rpcUrls: ["https://solana-rpc.test"],
                    chainName: "Solana",
                },
                token: {
                    address: "So11111111111111111111111111111111111111112",
                },
            },
        } as never;

        const rpcFetchSpy = vi
            .fn()
            .mockResolvedValue(
                createOkFetchResponse({ result: { value: null } }),
            );
        vi.stubGlobal(
            "fetch",
            createFetchWithDeployments(
                {
                    usdt0: {
                        native: [createSolanaLegacyMeshDeployment()],
                        legacyMesh: [createSolanaLegacyMeshDeployment()],
                    },
                },
                rpcFetchSpy,
            ),
        );

        const oft = {
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
        };

        await quoteOftSend(
            oft as never,
            getOftRoute("USDT0", "TEST-SOL"),
            validSolanaRecipient,
            100n,
        );
        await quoteOftSend(
            oft as never,
            getOftRoute("USDT0", "TEST-SOL"),
            validSolanaRecipient,
            200n,
        );

        expect(rpcFetchSpy).toHaveBeenCalledTimes(2);
    });

    test("should include Solana ATA creation options in OFT send params", async () => {
        const rpcFetchSpy = vi
            .fn()
            .mockResolvedValue(
                createOkFetchResponse({ result: { value: null } }),
            );
        vi.stubGlobal(
            "fetch",
            createFetchWithDeployments(
                {
                    usdt0: {
                        native: [
                            {
                                name: "Arbitrum",
                                chainId: 42161,
                                lzEid: "30110",
                                contracts: [
                                    {
                                        name: "OFT Adapter",
                                        address:
                                            "0x1000000000000000000000000000000000000001",
                                        explorer: "",
                                    },
                                ],
                            },
                        ],
                        legacyMesh: [createSolanaLegacyMeshDeployment()],
                    },
                },
                rpcFetchSpy,
            ),
        );

        const oft = {
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
        };

        const { sendParam } = await quoteOftSend(
            oft as never,
            getOftRoute("USDT0", "USDT0-SOL"),
            validSolanaRecipient,
            100n,
        );

        expect(sendParam[4]).toContain("000301002101");
    });

    test("should reject invalid hex-prefixed Solana recipients", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [],
                        legacyMesh: [createSolanaLegacyMeshDeployment()],
                    },
                }),
            }),
        );

        const oft = {
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
            send: vi.fn(),
        };

        await expect(
            quoteOftSend(
                oft as never,
                getOftRoute("USDT0", "USDT0-SOL"),
                "0x1234",
                100n,
            ),
        ).rejects.toThrow();
    });

    test("should fetch the received event by guid", async () => {
        const provider = {
            getLogs: vi.fn().mockResolvedValue([
                {
                    data: "0x1234",
                    topics: ["0xtopic", "0xguid"],
                    blockNumber: 123,
                    index: 5,
                },
            ]),
        };
        const contract = {
            transport: NetworkTransport.Evm,
            approvalRequired: vi.fn(),
            interface: {
                encodeFilterTopics: vi
                    .fn()
                    .mockReturnValue(["0xtopic", "0xguid"]),
                parseLog: vi.fn().mockReturnValue({
                    name: "OFTReceived",
                    args: {
                        guid: "0xguid",
                        srcEid: 40161n,
                        toAddress: "0x5000000000000000000000000000000000000000",
                        amountReceivedLD: 42n,
                    },
                }),
            },
        };

        await expect(
            getOftReceivedEventByGuid(
                contract as never,
                provider as never,
                "0x1000000000000000000000000000000000000000",
                "0xguid",
            ),
        ).resolves.toEqual({
            guid: "0xguid",
            srcEid: 40161n,
            toAddress: "0x5000000000000000000000000000000000000000",
            amountReceivedLD: 42n,
            blockNumber: 123,
            logIndex: 5,
        });

        expect(provider.getLogs).toHaveBeenCalledWith({
            address: "0x1000000000000000000000000000000000000000",
            fromBlock: 0,
            toBlock: "latest",
            topics: ["0xtopic", "0xguid"],
        });
    });

    test("should parse a Solana OFT send return from transaction logs", () => {
        const event = getSolanaOftSentEventFromTransaction([
            "Program return: Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7 RAYfEjUX28McJNZS29+yNa3JaNehFEaKBZ0WYsGMxBPhBAAAAAAAAA3PDQAAAAAAAAAAAAAAAAApqB4AAAAAAM+lHgAAAAAA",
        ]);
        expect(event).toEqual(
            "0x44061f123517dbc31c24d652dbdfb235adc968d7a114468a059d1662c18cc413",
        );
    });

    test("should decode Executor_NativeAmountExceedsCap reverts", () => {
        const error = {
            data: "0x0084ce020000000000000000000000000000000000000000000000000c49bf8c0491425000000000000000000000000000000000000000000000000002ea11e32ad50000",
        };

        expect(isExecutorNativeAmountExceedsCapError(error)).toBe(true);
        expect(decodeExecutorNativeAmountExceedsCapError(error)).toEqual({
            amount: 885449409847968336n,
            cap: 210000000000000000n,
        });
    });
});

export {};
