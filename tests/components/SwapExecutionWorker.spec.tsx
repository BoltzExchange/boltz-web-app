import { render, waitFor } from "@solidjs/testing-library";

let currentSwap: Record<string, unknown>;
let mockNetworkTransport = "evm";
const mockQueryFilter = vi.fn();
const mockLockupParseLog = vi.fn();
const mockGetTransaction = vi.fn();
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
const mockSendPopulatedTransaction = vi
    .fn<(...args: unknown[]) => Promise<string>>()
    .mockResolvedValue("0xcommitment");
const mockPostCommitmentSignatureForTransaction = vi
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined);
const createMockErc20Swap = () => {
    const contract = {
        getAddress: vi
            .fn()
            .mockResolvedValue("0x8000000000000000000000000000000000000000"),
        version: vi.fn().mockResolvedValue("2"),
        queryFilter: mockQueryFilter as (
            ...args: unknown[]
        ) => Promise<unknown[]>,
        filters: {
            Lockup: vi.fn().mockReturnValue("lockup-filter"),
        },
        interface: {
            parseLog: mockLockupParseLog as (...args: unknown[]) => unknown,
        },
        connect: vi.fn(),
    };
    contract.connect.mockReturnValue(contract);

    return contract;
};

vi.mock("../../src/config", () => ({
    config: {
        assets: {
            SRC: {
                network: {
                    chainId: 1,
                },
            },
            DST: {
                network: {
                    chainId: 2,
                },
            },
            "CCTP-SRC": {
                network: {
                    chainId: 6,
                },
            },
            USDC: {
                network: {
                    chainId: 3,
                },
            },
        },
    },
}));

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
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        swap: () => currentSwap,
        setSwap: mockSetSwap,
    }),
}));

vi.mock("../../src/context/Web3", () => ({
    createRouterContract: () => ({
        getAddress: vi
            .fn()
            .mockResolvedValue("0x7000000000000000000000000000000000000000"),
        executeAndLockERC20: {
            populateTransaction: vi.fn().mockResolvedValue({
                to: "0x7000000000000000000000000000000000000000",
                data: "0xlock",
            }),
        },
    }),
    createTokenContract: () => ({
        interface: {
            encodeFunctionData: vi.fn().mockReturnValue("0xtransfer"),
        },
    }),
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

vi.mock("../../src/utils/boltzClient", () => ({
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
    calculateAmountOutMin: (amount: bigint) => amount,
    calculateAmountWithSlippage: (amount: bigint) => amount,
}));

vi.mock("../../src/utils/chains/solana", () => ({
    getSolanaConnection: vi.fn(() => ({
        getTransaction: mockGetTransaction,
    })),
}));

vi.mock("../../src/utils/chains/tron", () => ({
    getTronTransactionInfo: mockGetTronTransactionInfo,
    isFailedTronTransaction,
}));

vi.mock("../../src/utils/commitment", () => ({
    emptyPreimageHash: `0x${"00".repeat(32)}`,
    isEmptyPreimageHash: (preimageHash?: string) =>
        preimageHash?.replace(/^0x/i, "").toLowerCase() === "00".repeat(32),
    postCommitmentSignatureForTransaction: (...args: unknown[]) =>
        mockPostCommitmentSignatureForTransaction(...args),
}));

vi.mock("../../src/utils/cctp/attestation", () => ({
    getCctpAttestation: async (...args: unknown[]): Promise<unknown> =>
        await mockGetCctpAttestation(...args),
}));

vi.mock("../../src/utils/evmTransaction", () => ({
    assertTransactionSignerProvider: (signer: { provider: unknown }) =>
        signer.provider,
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
}));

vi.mock("../../src/utils/provider", () => ({
    createAssetProvider: vi.fn(() => ({
        call: mockProviderCall,
        getLogs: vi.fn(),
        getTransactionReceipt: mockGetTransactionReceipt,
        getBlockNumber: mockGetBlockNumber,
    })),
}));

vi.mock("../../src/utils/oft/registry", () => ({
    getOftContract: vi.fn((route: { sourceAsset: string }) =>
        Promise.resolve({
            address:
                route.sourceAsset === "SRC"
                    ? "0x1111111111111111111111111111111111111111"
                    : "0x2222222222222222222222222222222222222222",
        }),
    ),
}));

vi.mock("../../src/utils/oft/solana", () => ({
    getSolanaOftGuidFromLogs: vi.fn().mockReturnValue("0xguid"),
}));

vi.mock("../../src/utils/oft/tron", () => ({
    getTronOftGuidFromTransactionInfo: mockGetTronOftGuidFromTransactionInfo,
}));

vi.mock("../../src/utils/oft/oft", () => ({
    createOftContract: vi.fn((address: string) => ({ address })),
    getOftProvider: vi.fn(() => ({
        getTransactionReceipt: vi.fn().mockResolvedValue({
            logs: [],
            blockNumber: 1,
        }),
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

vi.mock("../../src/utils/rootstock", () => ({
    prefix0x: (value: string) =>
        value.startsWith("0x") ? value : `0x${value}`,
    satsToAssetAmount: (value: number) => BigInt(value),
}));

const { SwapExecutionWorker } =
    await import("../../src/components/SwapExecutionWorker");
const oftUtils = await import("../../src/utils/oft/oft");

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
        mockPostCommitmentSignatureForTransaction
            .mockReset()
            .mockResolvedValue(undefined);
        mockQueryFilter.mockReset().mockResolvedValue([]);
        mockLockupParseLog.mockReset();
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
            status: 1,
            blockNumber: 10,
            hash: "0xcctpsend",
            logs: [
                {
                    topics: [cctpMessageSentTopic],
                    data: encodeBytesData(message),
                    index: 2,
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
            data: "0xtransfer",
        });
        expect(calls[2]).toMatchObject({
            to: "0x7000000000000000000000000000000000000000",
            data: "0xlock",
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
            status: 1,
            blockNumber: 10,
            hash: "0xcctpsend",
            logs: [
                {
                    topics: [cctpMessageSentTopic],
                    data: encodeBytesData(message),
                    index: 2,
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
            data: "0xtransfer",
        });
        expect(calls[1]).toMatchObject({
            to: "0x7000000000000000000000000000000000000000",
            data: "0xlock",
        });
    });

    test("should recover a pre-existing pre-OFT commitment lockup without sending again", async () => {
        mockQueryFilter.mockResolvedValue([
            {
                data: "0xlockup",
                topics: ["0xtopic"],
                transactionHash: "0xrecovered",
                index: 7,
            },
        ]);
        mockLockupParseLog.mockReturnValue({
            name: "Lockup",
            args: {
                preimageHash:
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                tokenAddress: "0xf100000000000000000000000000000000000000",
                claimAddress: "0xc000000000000000000000000000000000000000",
                refundAddress: "0x9000000000000000000000000000000000000000",
                timelock: 321n,
            },
        });

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
            "lockup-filter",
            5,
            "latest",
        );
    });

    test("should stop before rebroadcasting when recovery finds multiple matching pre-OFT lockups", async () => {
        mockQueryFilter.mockResolvedValue([
            {
                data: "0xlockup-1",
                topics: ["0xtopic"],
                transactionHash: "0xmatch-one",
                index: 7,
            },
            {
                data: "0xlockup-2",
                topics: ["0xtopic"],
                transactionHash: "0xmatch-two",
                index: 8,
            },
        ]);
        mockLockupParseLog.mockReturnValue({
            name: "Lockup",
            args: {
                preimageHash:
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                tokenAddress: "0xf100000000000000000000000000000000000000",
                claimAddress: "0xc000000000000000000000000000000000000000",
                refundAddress: "0x9000000000000000000000000000000000000000",
                timelock: 321n,
            },
        });

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockQueryFilter).toHaveBeenCalledWith(
                "lockup-filter",
                5,
                "latest",
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
            {
                data: "0xlockup",
                topics: ["0xtopic"],
                transactionHash: "0xrecovered-after-send",
                index: 8,
            },
        ]);
        mockLockupParseLog.mockReturnValue({
            name: "Lockup",
            args: {
                preimageHash:
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                tokenAddress: "0xf100000000000000000000000000000000000000",
                claimAddress: "0xc000000000000000000000000000000000000000",
                refundAddress: "0x9000000000000000000000000000000000000000",
                timelock: 321n,
            },
        });

        render(() => <SwapExecutionWorker />);

        await waitFor(() => {
            expect(mockSendPopulatedTransaction).toHaveBeenCalledTimes(1);
            expect(
                mockPostCommitmentSignatureForTransaction,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitmentTxHash: "0xrecovered-after-send",
                }),
            );
            expect(currentSwap.commitmentLockupTxHash).toEqual(
                "0xrecovered-after-send",
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
                    bridge: expect.objectContaining({
                        txHash: undefined,
                    }),
                }),
            );
        });

        expect(mockSetSwapStorage).toHaveBeenCalledWith(
            expect.objectContaining({
                bridge: expect.objectContaining({
                    txHash: undefined,
                }),
            }),
        );
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
            expect(mockSetSwapStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    bridge: expect.objectContaining({
                        txHash: undefined,
                    }),
                }),
            );
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
