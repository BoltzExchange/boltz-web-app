import { base58, hex } from "@scure/base";

import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";

const {
    decodeExecutorNativeAmountExceedsCapError,
    getOftContract,
    getOftReceivedEventByGuid,
    isExecutorNativeAmountExceedsCapError,
    quoteOftSend,
    resetOftStateForTests,
} = await import("../../src/utils/oft/oft");

const getOftRoute = (from: string, to = from) => ({
    from,
    to,
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
        resetOftStateForTests();
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
            quoteOFT: {
                staticCall: vi
                    .fn()
                    .mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            },
            quoteSend: {
                staticCall: vi.fn().mockResolvedValue([5n, 0n]),
            },
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
        expect(oft.quoteOFT.staticCall).toHaveBeenCalledWith(
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
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [],
                        legacyMesh: [
                            {
                                name: "Solana",
                                lzEid: "30168",
                                contracts: [
                                    {
                                        name: "OFT Store",
                                        address:
                                            "HyXJcgYpURfDhgzuyRL7zxP4FhLg7LZQMeDrR4MXZcMN",
                                        explorer: "",
                                    },
                                    {
                                        name: "OFT Program",
                                        address:
                                            "Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7",
                                        explorer: "",
                                    },
                                ],
                            },
                        ],
                    },
                }),
            }),
        );

        await expect(getOftContract(getOftRoute("USDT0-SOL"))).resolves.toEqual(
            {
                name: "OFT Program",
                address: "Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7",
                explorer: "",
            },
        );

        const oft = {
            quoteOFT: {
                staticCall: vi
                    .fn()
                    .mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            },
            quoteSend: {
                staticCall: vi.fn().mockResolvedValue([5n, 0n]),
            },
            send: vi.fn(),
        };
        const recipient = "11111111111111111111111111111111";

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

    test("should reject invalid hex-prefixed Solana recipients", async () => {
        const oft = {
            quoteOFT: {
                staticCall: vi
                    .fn()
                    .mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            },
            quoteSend: {
                staticCall: vi.fn().mockResolvedValue([5n, 0n]),
            },
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
                    index: 5,
                },
            ]),
        };
        const contract = {
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
            logIndex: 5,
        });

        expect(provider.getLogs).toHaveBeenCalledWith({
            address: "0x1000000000000000000000000000000000000000",
            fromBlock: 0,
            toBlock: "latest",
            topics: ["0xtopic", "0xguid"],
        });
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
