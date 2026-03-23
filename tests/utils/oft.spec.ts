import { base58, hex } from "@scure/base";

import { NetworkTransport, Usdt0MeshKind } from "../../src/configs/base";
import { config } from "../../src/config";
const {
    decodeExecutorNativeAmountExceedsCapError,
    getOftContract,
    getOftContracts,
    getOftReceivedEventByGuid,
    isExecutorNativeAmountExceedsCapError,
    quoteOftSend,
    resetOftStateForTests,
} = await import("../../src/utils/oft/oft");

describe("oft", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        resetOftStateForTests();
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
            transport: NetworkTransport.Evm,
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
            send: vi.fn(),
        };

        const { sendParam, msgFee } = await quoteOftSend(
            oft as never,
            137,
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

        await expect(getOftContract(1)).resolves.toEqual({
            name: "OFT Adapter",
            address: "0x1000000000000000000000000000000000000001",
            explorer: "",
            transport: NetworkTransport.Evm,
        });
    });

    test("should resolve legacy mesh assets by configured endpoint id", async () => {
        const originalAsset = config.assets["USDT0-TRON"];
        config.assets["USDT0-TRON"] = {
            ...config.assets.USDT0,
            canSend: false,
            network: {
                chainName: "Tron",
                symbol: "TRX",
                gasToken: "TRX",
                transport: NetworkTransport.Tron,
            },
            token: {
                address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                decimals: 6,
            },
            mesh: {
                kind: Usdt0MeshKind.Legacy,
                lzEid: "30420",
                recipientFormat: NetworkTransport.Tron,
            },
        };

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

        await expect(getOftContract("USDT0-TRON")).resolves.toEqual({
            name: "OFT",
            address: "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt",
            explorer: "",
            transport: NetworkTransport.Tron,
        });

        if (originalAsset === undefined) {
            delete config.assets["USDT0-TRON"];
        } else {
            config.assets["USDT0-TRON"] = originalAsset;
        }
    });

    test("should encode Solana recipients as 32-byte public keys", async () => {
        const originalAsset = config.assets["USDT0-SOL"];
        config.assets["USDT0-SOL"] = {
            ...config.assets.USDT0,
            canSend: false,
            network: {
                chainName: "Solana",
                symbol: "SOL",
                gasToken: "SOL",
                transport: NetworkTransport.Solana,
            },
            token: {
                address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                decimals: 6,
            },
            mesh: {
                kind: Usdt0MeshKind.Legacy,
                lzEid: "30168",
                recipientFormat: NetworkTransport.Solana,
            },
        };

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

        await expect(getOftContracts("USDT0-SOL")).resolves.toEqual([
            {
                name: "OFT Store",
                address: "HyXJcgYpURfDhgzuyRL7zxP4FhLg7LZQMeDrR4MXZcMN",
                explorer: "",
                transport: NetworkTransport.Solana,
            },
            {
                name: "OFT Program",
                address: "Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7",
                explorer: "",
                transport: NetworkTransport.Solana,
            },
        ]);
        await expect(getOftContract("USDT0-SOL")).resolves.toEqual({
            name: "OFT Program",
            address: "Fuww9mfc8ntAwxPUzFia7VJFAdvLppyZwhPJoXySZXf7",
            explorer: "",
            transport: NetworkTransport.Solana,
        });

        const oft = {
            transport: NetworkTransport.Evm,
            quoteOFT: vi.fn().mockResolvedValue([[0n, 0n], [], [100n, 99n]]),
            quoteSend: vi.fn().mockResolvedValue([5n, 0n]),
            send: vi.fn(),
        };
        const recipient = "11111111111111111111111111111111";

        const { sendParam } = await quoteOftSend(
            oft as never,
            "USDT0-SOL",
            recipient,
            100n,
        );

        expect(sendParam[1]).toEqual(`0x${hex.encode(base58.decode(recipient))}`);

        if (originalAsset === undefined) {
            delete config.assets["USDT0-SOL"];
        } else {
            config.assets["USDT0-SOL"] = originalAsset;
        }
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
