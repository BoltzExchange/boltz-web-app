import { render, waitFor } from "@solidjs/testing-library";
import type * as CctpModule from "boltz-swaps/cctp";
import type * as EvmModule from "boltz-swaps/evm";
import { erc20SwapAbi, routerAbi } from "boltz-swaps/generated/evm-abis";
import type * as OftModule from "boltz-swaps/oft";
import {
    type Hex,
    decodeAbiParameters,
    encodeAbiParameters,
    encodeEventTopics,
} from "viem";

import type * as LibProviderModule from "../../packages/boltz-swaps/src/evm/provider";
import { config as runtimeConfig } from "../../src/config";

let currentSwap: Record<string, unknown>;
let mockNetworkTransport = "evm";
const mockQueryFilter = vi.fn();
const mockGetTransaction = vi.fn();
const mockIsBlockhashValid = vi.fn();
const mockGetSignatureStatuses = vi.fn();
const mockGetTransactionReceipt = vi.fn();
const mockGetBlockNumber = vi.fn();
const mockProviderCall = vi.fn();
const mockGetTronTransactionInfo = vi.fn();
const mockGetTronOftGuidFromTransactionInfo = vi.fn().mockReturnValue("0xguid");
const mockGetCctpAttestation = vi.fn();
const isFailedTronTransaction = (transactionInfo: {
    result?: string;
    receipt?: {
        result?: string;
    };
}) =>
    transactionInfo.result === "FAILED" ||
    transactionInfo.receipt?.result !== "SUCCESS";

const mockSetSwapStorage = vi.fn((swap: Record<string, unknown>) => {
    currentSwap = { ...swap };
    return Promise.resolve();
});
const mockSetSwap = vi.fn((swap: Record<string, unknown>) => {
    currentSwap = { ...swap };
});
const mockGetSwap = vi.fn(() => Promise.resolve(currentSwap));
const mockGetSwaps = vi.fn(() => Promise.resolve([currentSwap]));
const mockFetchPairs = vi.fn().mockResolvedValue(undefined);
const mockPairs = vi.fn(() => ({
    chain: {
        FINAL: {
            BTC: {
                limits: {
                    minimal: 100,
                },
            },
        },
    },
}));
const mockSendPopulatedTransaction = vi
    .fn<(...args: unknown[]) => Promise<string>>()
    .mockResolvedValue("0xcommitment");
const mockPostCommitmentSignatureForTransaction = vi
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined);
const createMockErc20Swap = () => {
    return {
        address: "0x8000000000000000000000000000000000000000",
        abi: erc20SwapAbi,
        read: {
            version: vi.fn().mockResolvedValue("2"),
        },
    };
};

const buildLockupLog = ({
    transactionHash,
    logIndex,
}: {
    transactionHash: Hex;
    logIndex: number;
}) => ({
    address: "0x8000000000000000000000000000000000000000",
    data: encodeAbiParameters(
        [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
        [123n, "0xf100000000000000000000000000000000000000", 321n],
    ),
    topics: encodeEventTopics({
        abi: erc20SwapAbi,
        eventName: "Lockup",
        args: {
            preimageHash: `0x${"00".repeat(32)}`,
            claimAddress: "0xc000000000000000000000000000000000000000",
            refundAddress: "0x9000000000000000000000000000000000000000",
        },
    }),
    args: {
        preimageHash: `0x${"00".repeat(32)}` as Hex,
        amount: 123n,
        tokenAddress:
            "0xf100000000000000000000000000000000000000" as `0x${string}`,
        claimAddress:
            "0xc000000000000000000000000000000000000000" as `0x${string}`,
        refundAddress:
            "0x9000000000000000000000000000000000000000" as `0x${string}`,
        timelock: 321n,
    },
    eventName: "Lockup" as const,
    transactionHash,
    logIndex,
});

const originalAssets = runtimeConfig.assets;

beforeAll(() => {
    runtimeConfig.assets = {
        SRC: {
            network: {
                chainId: 1,
                transport: "evm",
            },
            bridge: {
                kind: "oft",
                canonicalAsset: "FINAL",
            },
            token: {
                address: "0xf200000000000000000000000000000000000000",
            },
        },
        DST: {
            network: {
                chainId: 2,
                transport: "evm",
            },
            bridge: {
                kind: "oft",
                canonicalAsset: "FINAL",
            },
            token: {
                address: "0xf200000000000000000000000000000000000000",
            },
        },
        FINAL: {
            network: {
                transport: "evm",
            },
            token: {
                address: "0xf100000000000000000000000000000000000000",
            },
        },
        "CCTP-SRC": {
            network: {
                chainId: 6,
                transport: "evm",
            },
            bridge: {
                kind: "cctp",
                canonicalAsset: "USDC",
                cctp: {
                    domain: 6,
                    tokenMessenger:
                        "0x5100000000000000000000000000000000000000",
                    messageTransmitter:
                        "0x5200000000000000000000000000000000000000",
                    transferMode: "fast",
                },
            },
            token: {
                address: "0xf200000000000000000000000000000000000000",
            },
        },
        USDC: {
            network: {
                chainId: 3,
                transport: "evm",
            },
            bridge: {
                kind: "cctp",
                canonicalAsset: "USDC",
                cctp: {
                    domain: 3,
                    tokenMessenger:
                        "0x5300000000000000000000000000000000000000",
                    messageTransmitter:
                        "0x5400000000000000000000000000000000000000",
                    transferMode: "fast",
                },
            },
            token: {
                address: "0xf200000000000000000000000000000000000000",
            },
        },
    } as never;
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
});

vi.mock("../../src/consts/Assets", () => ({
    USDC: "USDC",
    getAssetBridge: (asset: string) =>
        asset === "CCTP-SRC"
            ? {
                  kind: "cctp",
                  canonicalAsset: "USDC",
                  cctp: {
                      domain: 6,
                      tokenMessenger:
                          "0x5100000000000000000000000000000000000000",
                      messageTransmitter:
                          "0x5200000000000000000000000000000000000000",
                      transferMode: "fast",
                  },
              }
            : asset === "USDC"
              ? {
                    kind: "cctp",
                    canonicalAsset: "USDC",
                    cctp: {
                        domain: 3,
                        tokenMessenger:
                            "0x5300000000000000000000000000000000000000",
                        messageTransmitter:
                            "0x5400000000000000000000000000000000000000",
                        transferMode: "fast",
                    },
                }
              : asset === "SRC" || asset === "DST"
                ? {
                      kind: "oft",
                      canonicalAsset: "FINAL",
                  }
                : undefined,
    getNetworkTransport: () => "evm",
    getTokenAddress: (asset: string) =>
        asset === "FINAL"
            ? "0xf100000000000000000000000000000000000000"
            : "0xf200000000000000000000000000000000000000",
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        getSwap: mockGetSwap,
        getSwaps: mockGetSwaps,
        setSwapStorage: mockSetSwapStorage,
        slippage: () => 0.5,
        fetchPairs: mockFetchPairs,
        pairs: mockPairs,
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        swap: () => currentSwap,
        setSwap: mockSetSwap,
    }),
}));

vi.mock("../../src/context/Web3", () => ({
    useWeb3Signer: () => ({
        getErc20Swap: vi.fn(() => createMockErc20Swap()),
        getGasAbstractionSigner: vi.fn((asset: string) => ({
            address:
                asset === "DST" || asset === "USDC"
                    ? "0x9000000000000000000000000000000000000000"
                    : "0xa000000000000000000000000000000000000000",
            provider: {
                getLogs: vi.fn(),
            },
        })),
        signer: () => undefined,
    }),
}));

vi.mock("../../packages/boltz-swaps/src/evm/contracts.ts", () => ({
    createRouterContract: () => ({
        address: "0x7000000000000000000000000000000000000000",
        abi: routerAbi,
    }),
}));

vi.mock("../../packages/boltz-swaps/src/client.ts", () => ({
    encodeDexQuote: vi.fn().mockResolvedValue({
        calls: [
            {
                to: "0x6000000000000000000000000000000000000000",
                value: 0n,
                data: "abcd",
            },
        ],
    }),
    getCommitmentLockupDetails: vi.fn().mockResolvedValue({
        claimAddress: "0xb000000000000000000000000000000000000000",
        timelock: 321,
    }),
}));

vi.mock("../../src/utils/calculate", () => ({
    calculateAmountOutMin: (amount: bigint, slippage: number) =>
        amount - BigInt(Math.floor(Number(amount) * slippage)),
    calculateAmountWithSlippage: (amount: bigint, slippage: number) =>
        amount + BigInt(Math.floor(Number(amount) * slippage)),
}));

vi.mock("boltz-swaps/solana", () => ({
    getSolanaConnection: vi.fn(() => ({
        getTransaction: mockGetTransaction,
        isBlockhashValid: mockIsBlockhashValid,
        getSignatureStatuses: mockGetSignatureStatuses,
    })),
}));

vi.mock("boltz-swaps/tron", () => ({
    getTronTransactionInfo: mockGetTronTransactionInfo,
    isFailedTronTransaction,
}));

vi.mock("../../packages/boltz-swaps/src/evm/commitment.ts", () => ({
    emptyPreimageHash: `0x${"00".repeat(32)}`,
    isEmptyPreimageHash: (preimageHash?: string) =>
        preimageHash?.replace(/^0x/i, "").toLowerCase() === "00".repeat(32),
    postCommitmentSignatureForTransaction: (...args: unknown[]) =>
        mockPostCommitmentSignatureForTransaction(...args),
}));

vi.mock("boltz-swaps/cctp", async () => {
    const actual = await vi.importActual<typeof CctpModule>("boltz-swaps/cctp");
    return {
        ...actual,
        getCctpAttestation: async (...args: unknown[]): Promise<unknown> =>
            await mockGetCctpAttestation(...args),
    };
});

vi.mock("../../src/utils/evmTransaction", () => ({
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
    prefix0x: (value: string) =>
        value.startsWith("0x") ? value : `0x${value}`,
}));

const mockCreateAssetProvider = vi.fn(() => ({
    call: mockProviderCall,
    readContract: async (...args: unknown[]) => {
        const encoded = (await mockProviderCall(...args)) as Hex;
        const [decoded] = decodeAbiParameters([{ type: "uint256" }], encoded);
        return decoded;
    },
    getLogs: mockQueryFilter,
    getTransactionReceipt: mockGetTransactionReceipt,
    getBlockNumber: mockGetBlockNumber,
    getTransaction: mockGetTransaction,
}));

vi.mock("../../src/utils/provider", () => ({
    createAssetProvider: mockCreateAssetProvider,
}));

vi.mock(
    "../../packages/boltz-swaps/src/evm/provider.ts",
    async (importActual) => ({
        ...(await importActual<typeof LibProviderModule>()),
        createAssetProvider: mockCreateAssetProvider,
    }),
);

vi.mock("boltz-swaps/oft", async (importActual) => ({
    ...(await importActual<typeof OftModule>()),
    getOftContract: vi.fn((route: { sourceAsset: string }) =>
        Promise.resolve({
            address:
                route.sourceAsset === "SRC"
                    ? "0x1111111111111111111111111111111111111111"
                    : "0x2222222222222222222222222222222222222222",
        }),
    ),
    getSolanaOftGuidFromLogs: vi.fn().mockReturnValue("0xguid"),
    getTronOftGuidFromTransactionInfo: mockGetTronOftGuidFromTransactionInfo,
    createOftContract: vi.fn((address: string) => ({ address })),
    getOftProvider: vi.fn(() => ({
        getTransactionReceipt: vi.fn().mockResolvedValue({
            logs: [],
            blockNumber: 1,
        }),
        getBlockNumber: mockGetBlockNumber,
    })),
    getOftTransport: vi.fn(() => mockNetworkTransport),
    getOftReceivedEventByGuid: vi.fn().mockResolvedValue({
        amountReceivedLD: 150n,
        blockNumber: 5,
    }),
    getOftSentEvent: vi.fn().mockReturnValue({
        guid: "0xguid",
    }),
}));

vi.mock("../../src/utils/quoter", () => ({
    fetchDexQuote: vi.fn().mockResolvedValue({
        trade: {
            amountOut: 150n,
            data: "0xquote",
        },
    }),
}));

vi.mock("boltz-swaps/evm", async (importActual) => ({
    ...(await importActual<typeof EvmModule>()),
    satsToAssetAmount: (value: number) => BigInt(value),
    assetAmountToSats: (value: bigint) => value,
    createAssetProvider: mockCreateAssetProvider,
}));

const { SwapExecutionWorker } =
    await import("../../src/components/SwapExecutionWorker");
const oftUtils = await import("boltz-swaps/oft");
const quoter = await import("../../src/utils/quoter");

const cctpMessageSentTopic =
    "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";
const u32Hex = (n: number) => n.toString(16).padStart(8, "0");
const u256Hex = (n: bigint) => n.toString(16).padStart(64, "0");
const encodeUint256 = (n: bigint) => `0x${u256Hex(n)}`;
const encodeBytesData = (hexValue: string): string => {
    const stripped = hexValue.startsWith("0x") ? hexValue.slice(2) : hexValue;
    const lengthBytes = stripped.length / 2;
    const paddingBytes = (32 - (lengthBytes % 32)) % 32;
    return `0x${"20".padStart(64, "0")}${lengthBytes
        .toString(16)
        .padStart(64, "0")}${stripped}${"00".repeat(paddingBytes)}`;
};
const buildCctpMessage = ({
    sourceDomain,
    destinationDomain,
    mintRecipient,
    amount,
    feeExecuted = 0n,
    nonce = "00".repeat(32),
}: {
    sourceDomain: number;
    destinationDomain: number;
    mintRecipient: string;
    amount: bigint;
    feeExecuted?: bigint;
    nonce?: string;
}) => {
    const strip = (value: string) =>
        value.startsWith("0x") ? value.slice(2) : value;
    const sender = "000000000000000000000000" + "51".repeat(20);
    const recipient = "000000000000000000000000" + "53".repeat(20);
    const header =
        u32Hex(2) +
        u32Hex(sourceDomain) +
        u32Hex(destinationDomain) +
        strip(nonce).padStart(64, "0") +
        sender +
        recipient +
        "00".repeat(32) +
        u32Hex(1000) +
        u32Hex(1000);
    const body =
        u32Hex(1) +
        "00".repeat(32) +
        strip(mintRecipient).padStart(64, "0") +
        u256Hex(amount) +
        "00".repeat(32) +
        "00".repeat(32) +
        u256Hex(feeExecuted) +
        "00".repeat(32);
    return `0x${header}${body}`;
};

describe("SwapExecutionWorker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNetworkTransport = "evm";
        mockGetTransaction.mockReset();
        mockIsBlockhashValid.mockReset().mockResolvedValue({
            value: true,
        });
        mockGetSignatureStatuses.mockReset().mockResolvedValue({
            value: [null],
        });
        mockGetTransactionReceipt.mockReset();
        mockGetBlockNumber.mockReset().mockResolvedValue(12);
        mockProviderCall.mockReset().mockResolvedValue(encodeUint256(0n));
        mockGetCctpAttestation.mockReset();
        mockGetTronTransactionInfo.mockReset();
        mockGetTronOftGuidFromTransactionInfo
            .mockReset()
            .mockReturnValue("0xguid");
        mockSendPopulatedTransaction
            .mockReset()
            .mockResolvedValue("0xcommitment");
        vi.mocked(quoter.fetchDexQuote)
            .mockReset()
            .mockResolvedValue({
                trade: {
                    amountIn: 150n,
                    amountOut: 150n,
                    data: "0xquote",
                },
            });
        mockPostCommitmentSignatureForTransaction
            .mockReset()
            .mockResolvedValue(undefined);
        mockQueryFilter.mockReset().mockResolvedValue([]);
        Object.defineProperty(window.navigator, "locks", {
            configurable: true,
            value: {
                request: vi.fn(
                    async (_name: string, callback: () => Promise<unknown>) =>
                        await callback(),
                ),
            },
        });
        currentSwap = {
            id: "swap-1",
            type: "chain",
            status: "invoice.set",
            assetSend: "FINAL",
            assetReceive: "BTC",
            sendAmount: 100,
            gasAbstraction: {
                lockup: "signer",
                claim: "none",
            },
            claimAddress: "0xc000000000000000000000000000000000000000",
            preimage: "11".repeat(32),
            lockupDetails: {
                timeoutBlockHeight: 144,
                claimAddress: "0xc000000000000000000000000000000000000000",
            },
            dex: {
                position: "pre",
                hops: [
                    {
                        dexDetails: {
                            chain: "1",
                            tokenIn:
                                "0xd000000000000000000000000000000000000000",
                            tokenOut:
                                "0xe000000000000000000000000000000000000000",
                        },
                    },
                ],
                quoteAmount: "100",
            },
            bridge: {
                kind: "oft",
                sourceAsset: "SRC",
                destinationAsset: "DST",
                position: "pre",
                txHash: "0xoftsend",
            },
        };
    });

    test("should execute pre-OFT lockup and post the commitment in the background", async () => {
        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalled();
            expect(
                mockPostCommitmentSignatureForTransaction,
            ).toHaveBeenCalled();
            expect(mockSetSwapStorage).toHaveBeenCalledTimes(2);
            expect(currentSwap.commitmentLockupTxHash).toEqual("0xcommitment");
            expect(currentSwap.commitmentSignatureSubmitted).toEqual(true);
        });
    });

    test("should persist a blocked pre-bridge state when DEX quote stays below the lockup amount", async () => {
        vi.useFakeTimers();
        try {
            vi.mocked(quoter.fetchDexQuote).mockResolvedValue({
                trade: {
                    amountIn: 150n,
                    amountOut: 49n,
                    data: "0xquote",
                },
            });

            render(() => <SwapExecutionWorker />);

            await vi.runAllTimersAsync();

            expect(quoter.fetchDexQuote).toHaveBeenCalledTimes(3);
            expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
            expect(currentSwap.execution).toEqual({
                preBridgeRecovery: expect.objectContaining({
                    status: "blocked",
                    asset: "DST",
                    amount: "150",
                }),
            });
            expect(mockSetSwapStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    execution: expect.objectContaining({
                        preBridgeRecovery: expect.objectContaining({
                            status: "blocked",
                            asset: "DST",
                            amount: "150",
                        }),
                    }),
                }),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    test("should execute pre-bridge lockup when the DEX quote is within slippage", async () => {
        vi.mocked(quoter.fetchDexQuote).mockResolvedValueOnce({
            trade: {
                amountIn: 150n,
                amountOut: 50n,
                data: "0xquote",
            },
        });

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalled();
            expect(mockSetSwapStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitmentLockupTxHash: "0xcommitment",
                }),
            );
        });

        expect(currentSwap.execution).toBeUndefined();
    });

    test("should lock immediately without retrying when the lockup clears the renegotiation minimum", async () => {
        mockPairs.mockReturnValue({
            chain: {
                FINAL: {
                    BTC: {
                        limits: {
                            minimal: 20,
                        },
                    },
                },
            },
        });
        // Below the slippage threshold (requiredAmount 50) but the resulting
        // lockup (25) still clears the renegotiation minimum (20).
        vi.mocked(quoter.fetchDexQuote).mockResolvedValue({
            trade: {
                amountIn: 150n,
                amountOut: 49n,
                data: "0xquote",
            },
        });

        try {
            render(() => <SwapExecutionWorker />);

            await waitFor(() => {
                expect(mockSendPopulatedTransaction).toHaveBeenCalled();
            });

            expect(quoter.fetchDexQuote).toHaveBeenCalledTimes(1);
            expect(currentSwap.execution).toBeUndefined();
        } finally {
            mockPairs.mockReturnValue({
                chain: {
                    FINAL: {
                        BTC: {
                            limits: {
                                minimal: 100,
                            },
                        },
                    },
                },
            });
        }
    });

    test("should mint manual CCTP before executing the pre-bridge lockup", async () => {
        const mintRecipient =
            "0x0000000000000000000000009000000000000000000000000000000000000000";
        const message = buildCctpMessage({
            sourceDomain: 6,
            destinationDomain: 3,
            mintRecipient,
            amount: 151n,
            feeExecuted: 1n,
        });
        mockGetTransactionReceipt.mockResolvedValue({
            status: "success",
            blockNumber: 10n,
            transactionHash: "0xcctpsend",
            logs: [
                {
                    topics: [cctpMessageSentTopic],
                    data: encodeBytesData(message),
                    logIndex: 2,
                },
            ],
        });
        mockGetCctpAttestation.mockResolvedValue({
            status: "complete",
            message,
            attestation: "0x12",
        });
        currentSwap = {
            ...currentSwap,
            bridge: {
                kind: "cctp",
                sourceAsset: "CCTP-SRC",
                destinationAsset: "USDC",
                position: "pre",
                txHash: "0xcctpsend",
            },
        };

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalled();
            expect(currentSwap.commitmentLockupTxHash).toEqual("0xcommitment");
        });

        const calls = mockSendPopulatedTransaction.mock.calls[0][2] as Array<{
            to: string;
            data?: string;
            value?: string;
        }>;
        expect(calls).toHaveLength(3);
        expect(calls[0]).toMatchObject({
            to: "0x5400000000000000000000000000000000000000",
            value: "0",
        });
        expect(calls[1]).toMatchObject({
            to: "0xf200000000000000000000000000000000000000",
            data: expect.stringMatching(/^0x[0-9a-f]+$/),
        });
        expect(calls[2]).toMatchObject({
            to: "0x7000000000000000000000000000000000000000",
            data: expect.stringMatching(/^0x[0-9a-f]+$/),
        });
        expect(mockGetCctpAttestation).toHaveBeenCalledWith(6, "0xcctpsend");
    });

    test("should skip manual CCTP mint when the nonce is already used", async () => {
        const mintRecipient =
            "0x0000000000000000000000009000000000000000000000000000000000000000";
        const message = buildCctpMessage({
            sourceDomain: 6,
            destinationDomain: 3,
            mintRecipient,
            amount: 151n,
            feeExecuted: 1n,
            nonce: "01".repeat(32),
        });
        mockProviderCall.mockResolvedValue(encodeUint256(1n));
        mockGetTransactionReceipt.mockResolvedValue({
            status: "success",
            blockNumber: 10n,
            transactionHash: "0xcctpsend",
            logs: [
                {
                    topics: [cctpMessageSentTopic],
                    data: encodeBytesData(message),
                    logIndex: 2,
                },
            ],
        });
        mockGetCctpAttestation.mockResolvedValue({
            status: "complete",
            message,
            attestation: "0x12",
        });
        currentSwap = {
            ...currentSwap,
            bridge: {
                kind: "cctp",
                sourceAsset: "CCTP-SRC",
                destinationAsset: "USDC",
                position: "pre",
                txHash: "0xcctpsend",
            },
        };

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalled();
            expect(currentSwap.commitmentLockupTxHash).toEqual("0xcommitment");
        });

        const calls = mockSendPopulatedTransaction.mock.calls[0][2] as Array<{
            to: string;
            data?: string;
            value?: string;
        }>;
        expect(calls).toHaveLength(2);
        expect(calls[0]).toMatchObject({
            to: "0xf200000000000000000000000000000000000000",
            data: expect.stringMatching(/^0x[0-9a-f]+$/),
        });
        expect(calls[1]).toMatchObject({
            to: "0x7000000000000000000000000000000000000000",
            data: expect.stringMatching(/^0x[0-9a-f]+$/),
        });
    });

    test("should recover a pre-existing pre-OFT commitment lockup without sending again", async () => {
        mockQueryFilter.mockResolvedValue([
            buildLockupLog({
                transactionHash: "0xrecovered",
                logIndex: 7,
            }),
        ]);

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
            expect(
                mockPostCommitmentSignatureForTransaction,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitmentTxHash: "0xrecovered",
                }),
            );
            expect(currentSwap.commitmentLockupTxHash).toEqual("0xrecovered");
            expect(currentSwap.commitmentSignatureSubmitted).toEqual(true);
        });

        expect(mockQueryFilter).toHaveBeenCalledWith(
            expect.objectContaining({
                address: "0x8000000000000000000000000000000000000000",
                fromBlock: 5n,
                toBlock: "latest",
            }),
        );
    });

    test("should stop before rebroadcasting when recovery finds multiple matching pre-OFT lockups", async () => {
        mockQueryFilter.mockResolvedValue([
            buildLockupLog({
                transactionHash: "0xmatch01",
                logIndex: 7,
            }),
            buildLockupLog({
                transactionHash: "0xmatch02",
                logIndex: 8,
            }),
        ]);

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockQueryFilter).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: "0x8000000000000000000000000000000000000000",
                    fromBlock: 5n,
                    toBlock: "latest",
                }),
            );
        });
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
        expect(currentSwap.commitmentLockupTxHash).toBeUndefined();
        expect(
            mockPostCommitmentSignatureForTransaction,
        ).not.toHaveBeenCalled();
    });

    test("should recover the commitment lockup after an Alchemy send failure", async () => {
        mockSendPopulatedTransaction.mockRejectedValueOnce(
            new Error("Alchemy request failed for wallet_sendPreparedCalls"),
        );
        mockQueryFilter.mockResolvedValueOnce([]).mockResolvedValueOnce([
            buildLockupLog({
                transactionHash: "0xrecoveredaftersend",
                logIndex: 8,
            }),
        ]);

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalledTimes(1);
            expect(
                mockPostCommitmentSignatureForTransaction,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitmentTxHash: "0xrecoveredaftersend",
                }),
            );
            expect(currentSwap.commitmentLockupTxHash).toEqual(
                "0xrecoveredaftersend",
            );
            expect(currentSwap.commitmentSignatureSubmitted).toEqual(true);
        });
    });

    test("should keep the swap unresolved when recovery finds no lockup after an Alchemy send failure", async () => {
        mockSendPopulatedTransaction.mockRejectedValueOnce(
            new Error("Alchemy request failed for wallet_sendPreparedCalls"),
        );
        mockQueryFilter.mockResolvedValue([]);

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalledTimes(1);
        });

        expect(currentSwap.commitmentLockupTxHash).toBeUndefined();
        expect(
            mockPostCommitmentSignatureForTransaction,
        ).not.toHaveBeenCalled();
    });

    test("should abandon a failed Solana OFT send before decoding the guid", async () => {
        mockNetworkTransport = "solana";
        mockGetTransaction.mockResolvedValue({
            slot: 123,
            meta: {
                err: {
                    InstructionError: [0, "Custom"],
                },
                logMessages: [],
            },
        });

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSetSwapStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    bridge: expect.not.objectContaining({
                        txHash: expect.any(String),
                    }),
                }),
            );
        });
    });

    test("should abandon an expired dropped Solana OFT send", async () => {
        mockNetworkTransport = "solana";
        mockGetTransaction.mockResolvedValue(null);
        mockIsBlockhashValid.mockResolvedValue({
            value: false,
        });
        mockGetSignatureStatuses.mockResolvedValue({
            value: [null],
        });
        currentSwap = {
            ...currentSwap,
            bridge: {
                ...(currentSwap.bridge as Record<string, unknown>),
                details: {
                    solana: {
                        blockhash: "11111111111111111111111111111111",
                    },
                },
            },
        };

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockGetSignatureStatuses).toHaveBeenCalledWith(
                ["0xoftsend"],
                {
                    searchTransactionHistory: true,
                },
            );
            expect(mockIsBlockhashValid).toHaveBeenCalledWith(
                "11111111111111111111111111111111",
                {
                    commitment: "confirmed",
                },
            );
        });

        await waitFor(() => {
            const savedSwap = mockSetSwapStorage.mock.calls.at(-1)?.[0];
            const bridge = savedSwap?.bridge as
                | Record<string, unknown>
                | undefined;

            expect(bridge?.txHash).toBeUndefined();
            expect(bridge?.details).toBeUndefined();
        });
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });

    test("should keep waiting for a processed Solana OFT send with an expired blockhash", async () => {
        mockNetworkTransport = "solana";
        mockGetTransaction.mockResolvedValue(null);
        mockIsBlockhashValid.mockResolvedValue({
            value: false,
        });
        mockGetSignatureStatuses.mockResolvedValue({
            value: [
                {
                    confirmationStatus: "processed",
                    confirmations: 0,
                    err: null,
                    slot: 417563870,
                    status: {
                        Ok: null,
                    },
                },
            ],
        });
        currentSwap = {
            ...currentSwap,
            bridge: {
                ...(currentSwap.bridge as Record<string, unknown>),
                details: {
                    solana: {
                        blockhash: "11111111111111111111111111111111",
                    },
                },
            },
        };

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockGetSignatureStatuses).toHaveBeenCalledWith(
                ["0xoftsend"],
                {
                    searchTransactionHistory: true,
                },
            );
        });
        expect(mockIsBlockhashValid).not.toHaveBeenCalled();
        expect(mockSetSwapStorage).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });

    test("should keep waiting for a dropped Solana OFT send while the blockhash is valid", async () => {
        mockNetworkTransport = "solana";
        mockGetTransaction.mockResolvedValue(null);
        mockIsBlockhashValid.mockResolvedValue({
            value: true,
        });
        mockGetSignatureStatuses.mockResolvedValue({
            value: [null],
        });
        currentSwap = {
            ...currentSwap,
            bridge: {
                ...(currentSwap.bridge as Record<string, unknown>),
                details: {
                    solana: {
                        blockhash: "11111111111111111111111111111111",
                    },
                },
            },
        };

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockGetSignatureStatuses).toHaveBeenCalledWith(
                ["0xoftsend"],
                {
                    searchTransactionHistory: true,
                },
            );
            expect(mockIsBlockhashValid).toHaveBeenCalledWith(
                "11111111111111111111111111111111",
                {
                    commitment: "confirmed",
                },
            );
        });
        expect(mockSetSwapStorage).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });

    test("should abandon a failed Tron OFT send before decoding the guid", async () => {
        mockNetworkTransport = "tron";
        mockGetTronTransactionInfo.mockResolvedValue({
            blockNumber: 123,
            receipt: {
                result: "FAILED",
            },
        });

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(
                (currentSwap.bridge as Record<string, unknown>).txHash,
            ).toBeUndefined();
        });

        expect(mockGetTronOftGuidFromTransactionInfo).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
    });

    test("should decode the guid from a confirmed Tron OFT send", async () => {
        mockNetworkTransport = "tron";
        mockGetTronTransactionInfo.mockResolvedValue({
            blockNumber: 123,
            receipt: {
                result: "SUCCESS",
            },
            log: [],
        });

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockGetTronOftGuidFromTransactionInfo).toHaveBeenCalledWith(
                expect.objectContaining({
                    blockNumber: 123,
                    receipt: expect.objectContaining({
                        result: "SUCCESS",
                    }),
                    log: [],
                }),
                "0x1111111111111111111111111111111111111111",
            );
            expect(mockSendPopulatedTransaction).toHaveBeenCalled();
            expect(
                mockPostCommitmentSignatureForTransaction,
            ).toHaveBeenCalled();
        });
    });

    test("should ignore stale pre-OFT swaps that already moved past the pre-lockup stage", async () => {
        currentSwap = {
            ...currentSwap,
            status: "transaction.confirmed",
        };

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockGetSwaps).toHaveBeenCalled();
        });

        expect(oftUtils.getOftSentEvent).not.toHaveBeenCalled();
        expect(mockSendPopulatedTransaction).not.toHaveBeenCalled();
        expect(
            mockPostCommitmentSignatureForTransaction,
        ).not.toHaveBeenCalled();
    });
});
