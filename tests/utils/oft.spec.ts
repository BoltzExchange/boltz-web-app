// @vitest-environment node
import { base58, hex } from "@scure/base";
import { OftBridgeDriver } from "boltz-swaps/bridge";
import {
    clearOftDeployments,
    createOftContract,
    decodeExecutorNativeAmountExceedsCapError,
    getOftContract,
    getOftReceivedEventByGuid,
    getRequiredSolanaOftNativeBalance,
    getSolanaOftGuidFromLogs as getSolanaOftSentEventFromTransaction,
    isExecutorNativeAmountExceedsCapError,
    oftAbi,
    quoteOftAmountInForAmountOut,
    quoteOftSend,
} from "boltz-swaps/oft";
import * as solanaChain from "boltz-swaps/solana";
import {
    AssetKind,
    BridgeKind,
    CctpTransferMode,
    NetworkTransport,
} from "boltz-swaps/types";
import { encodeAbiParameters, encodeEventTopics, getAbiItem } from "viem";

import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";

const getOftRoute = (from: string, to = from) => ({
    sourceAsset: from,
    destinationAsset: to,
});

const validSolanaRecipient = "BZkwksSEeHrCVS3HeewBJKEBTEEuwnEqpkHqEg1dRpuE";
const expectedLegacyMeshSolanaNativeDropOptions =
    "0x000301003102000000000000000000000000000000079cf92493ad22afbeb6a541bd811c7fc83e1fc0800384cf03ef7f2c2e888bcfb1";
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
const createTronLegacyMeshDeployment = (
    contracts = [
        {
            name: "OFT",
            address: "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt",
            explorer: "",
        },
    ],
) => ({
    name: "Tron",
    lzEid: "30420",
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

const originalAssets = structuredClone(runtimeConfig.assets);
const originalNetwork = runtimeConfig.network;

describe("oft", () => {
    beforeAll(() => {
        runtimeConfig.assets = structuredClone(mainnetConfig.assets);
        runtimeConfig.network = mainnetConfig.network;
    });

    beforeEach(() => {
        vi.spyOn(solanaChain, "getSolanaRentExemptMinimumBalance");
        vi.spyOn(
            solanaChain,
            "shouldCreateSolanaTokenAccount",
        ).mockResolvedValue(false);
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

    test("should use the higher of the buffered Solana OFT fee or ATA rent", async () => {
        vi.mocked(
            solanaChain.getSolanaRentExemptMinimumBalance,
        ).mockResolvedValue(2_039_280n);
        await expect(
            getRequiredSolanaOftNativeBalance("USDT0-SOL", 1_000_000n),
        ).resolves.toBe(2_039_280n);
        await expect(
            getRequiredSolanaOftNativeBalance("USDT0-SOL", 3_000_000n),
        ).resolves.toBe(3_300_000n);
        expect(
            solanaChain.getSolanaRentExemptMinimumBalance,
        ).toHaveBeenCalledWith("USDT0-SOL", 165);
    });

    test("should expose the Solana OFT native balance requirement through the bridge driver", async () => {
        vi.mocked(
            solanaChain.getSolanaRentExemptMinimumBalance,
        ).mockResolvedValue(2_039_280n);

        const driver = new OftBridgeDriver();
        await expect(
            driver.getTransportRequiredNativeBalance(getOftRoute("USDT0-SOL"), [
                1_000_000n,
                0n,
            ]),
        ).resolves.toBe(2_039_280n);
    });

    test("should resolve legacy mesh assets by configured endpoint id", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [],
                        legacyMesh: [createTronLegacyMeshDeployment()],
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

    test("should create a Tron OFT client for live Tron deployments", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    usdt0: {
                        native: [],
                        legacyMesh: [createTronLegacyMeshDeployment()],
                    },
                }),
            }),
        );

        await expect(
            createOftContract(getOftRoute("USDT0-TRON")),
        ).resolves.toEqual(
            expect.objectContaining({
                transport: NetworkTransport.Tron,
            }),
        );
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

    test("should reject CCTP assets before OFT quoting", async () => {
        runtimeConfig.assets = {
            ...runtimeConfig.assets,
            "CCTP-TEST": {
                type: AssetKind.ERC20,
                network: {
                    transport: NetworkTransport.Evm,
                    chainId: 1,
                    chainName: "Ethereum",
                    symbol: "ETH",
                    gasToken: "ETH",
                    rpcUrls: [],
                },
                bridge: {
                    kind: BridgeKind.Cctp,
                    canonicalAsset: "USDC",
                    cctp: {
                        domain: 0,
                        tokenMessenger:
                            "0x0000000000000000000000000000000000000001",
                        messageTransmitter:
                            "0x0000000000000000000000000000000000000002",
                        transferMode: CctpTransferMode.Fast,
                    },
                },
            },
        };

        await expect(
            quoteOftAmountInForAmountOut(
                getOftRoute("CCTP-TEST", "USDT0-SOL"),
                1_000_000_000n,
            ),
        ).rejects.toThrow("requires OFT bridge assets");
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
            solanaChain.shouldCreateSolanaTokenAccount(
                "USDT0-ETH",
                validSolanaRecipient,
            ),
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

        vi.mocked(solanaChain.shouldCreateSolanaTokenAccount).mockResolvedValue(
            true,
        );
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

        expect(
            solanaChain.shouldCreateSolanaTokenAccount,
        ).toHaveBeenCalledTimes(2);
    });

    test("should include Solana ATA creation options in OFT send params", async () => {
        vi.mocked(solanaChain.shouldCreateSolanaTokenAccount).mockResolvedValue(
            true,
        );
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

    test("should encode legacy mesh native drops for Solana recipients", async () => {
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
            getOftRoute("USDT0-ETH", "USDT0-SOL"),
            validSolanaRecipient,
            100n,
            {
                nativeDrop: {
                    amount: 7n,
                    receiver: validSolanaRecipient,
                },
            },
        );

        expect(sendParam[4]).toBe(expectedLegacyMeshSolanaNativeDropOptions);
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

    describe("getOftReceivedEventByGuid", () => {
        const contractAddress = "0x1000000000000000000000000000000000000000";
        const guid = `0x${"11".repeat(32)}` as `0x${string}`;
        const toAddress =
            "0x5000000000000000000000000000000000000000" as `0x${string}`;
        const contract = {
            transport: NetworkTransport.Evm,
            approvalRequired: vi.fn(),
            abi: oftAbi,
        };

        const buildMatchingLog = () => ({
            address: contractAddress,
            data: encodeAbiParameters(
                [{ type: "uint32" }, { type: "uint256" }],
                [40161, 42n],
            ),
            topics: encodeEventTopics({
                abi: oftAbi,
                eventName: "OFTReceived",
                args: { guid, toAddress },
            }),
            blockNumber: 123,
            logIndex: 5,
        });

        test("should fetch the received event by guid using chunked ranges", async () => {
            const latestBlock = 1_000_000n;
            const provider = {
                getBlockNumber: vi.fn().mockResolvedValue(latestBlock),
                getLogs: vi
                    .fn()
                    .mockImplementation(({ toBlock }: { toBlock: bigint }) =>
                        Promise.resolve(
                            toBlock === latestBlock ? [buildMatchingLog()] : [],
                        ),
                    ),
            };

            await expect(
                getOftReceivedEventByGuid(
                    contract as never,
                    provider as never,
                    contractAddress,
                    guid,
                ),
            ).resolves.toEqual({
                guid,
                srcEid: 40161,
                toAddress,
                amountReceivedLD: 42n,
                blockNumber: 123,
                logIndex: 5,
            });

            // First parallel batch starts at the latest block and walks back
            // in 175_000-block chunks (~12h on Arbitrum).
            expect(provider.getLogs).toHaveBeenCalledWith({
                address: contractAddress,
                event: getAbiItem({ abi: oftAbi, name: "OFTReceived" }),
                args: { guid },
                fromBlock: 825_001n,
                toBlock: latestBlock,
            });
        });

        test("should stop scanning after the first batch with a match", async () => {
            const latestBlock = 1_000_000n;
            const provider = {
                getBlockNumber: vi.fn().mockResolvedValue(latestBlock),
                getLogs: vi
                    .fn()
                    .mockImplementation(({ toBlock }: { toBlock: bigint }) =>
                        Promise.resolve(
                            toBlock === latestBlock ? [buildMatchingLog()] : [],
                        ),
                    ),
            };

            await getOftReceivedEventByGuid(
                contract as never,
                provider as never,
                contractAddress,
                guid,
            );

            // The first batch covers all 1_000_000 blocks down to the
            // 650_000 lookback floor in 3 parallel calls (175_000-block
            // chunks), then the loop terminates because that batch matched.
            expect(provider.getLogs).toHaveBeenCalledTimes(3);
        });

        test("should return undefined and bound calls when no event is found", async () => {
            // Pick a latestBlock above maxLookbackBlocks so the cap engages
            // rather than the 0-block clamp.
            const latestBlock = 50_000_000n;
            const provider = {
                getBlockNumber: vi.fn().mockResolvedValue(latestBlock),
                getLogs: vi.fn().mockResolvedValue([]),
            };

            await expect(
                getOftReceivedEventByGuid(
                    contract as never,
                    provider as never,
                    contractAddress,
                    guid,
                ),
            ).resolves.toBeUndefined();

            // 350_000 lookback / 175_000 chunk = 2 ranges, plus the final
            // range that lands exactly on minBlock. The whole sweep fits in
            // a single parallel batch.
            expect(provider.getLogs).toHaveBeenCalledTimes(3);
        });

        test("should respect a fromBlock hint instead of the default lookback", async () => {
            const latestBlock = 50_000_000n;
            const fromBlock = 49_999_500n;
            const provider = {
                getBlockNumber: vi.fn().mockResolvedValue(latestBlock),
                getLogs: vi.fn().mockResolvedValue([]),
            };

            await getOftReceivedEventByGuid(
                contract as never,
                provider as never,
                contractAddress,
                guid,
                { fromBlock },
            );

            // Window of 501 blocks fits in a single chunk of the first batch.
            expect(provider.getLogs).toHaveBeenCalledTimes(1);
            expect(provider.getLogs).toHaveBeenCalledWith({
                address: contractAddress,
                event: getAbiItem({ abi: oftAbi, name: "OFTReceived" }),
                args: { guid },
                fromBlock,
                toBlock: latestBlock,
            });
        });

        test("should clamp a fromBlock hint above latestBlock to latestBlock", async () => {
            const latestBlock = 1_000n;
            const provider = {
                getBlockNumber: vi.fn().mockResolvedValue(latestBlock),
                getLogs: vi.fn().mockResolvedValue([]),
            };

            await getOftReceivedEventByGuid(
                contract as never,
                provider as never,
                contractAddress,
                guid,
                { fromBlock: 5_000n },
            );

            expect(provider.getLogs).toHaveBeenCalledTimes(1);
            expect(provider.getLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    fromBlock: latestBlock,
                    toBlock: latestBlock,
                }),
            );
        });

        test("should reject malformed guids", async () => {
            const provider = {
                getBlockNumber: vi.fn().mockResolvedValue(0n),
                getLogs: vi.fn(),
            };

            await expect(
                getOftReceivedEventByGuid(
                    contract as never,
                    provider as never,
                    contractAddress,
                    "not-hex",
                ),
            ).rejects.toThrow("invalid OFT guid");

            expect(provider.getLogs).not.toHaveBeenCalled();
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
