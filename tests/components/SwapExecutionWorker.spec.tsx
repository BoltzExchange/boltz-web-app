import { render, waitFor } from "@solidjs/testing-library";

let currentSwap: Record<string, unknown>;
let mockNetworkTransport = "evm";
const mockQueryFilter = vi.fn();
const mockLockupParseLog = vi.fn();
const mockGetTransaction = vi.fn();

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
        },
    },
}));

vi.mock("../../src/consts/Assets", () => ({
    getNetworkTransport: () => mockNetworkTransport,
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
                asset === "DST"
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

vi.mock("../../src/utils/commitment", () => ({
    postCommitmentSignatureForTransaction: (...args: unknown[]) =>
        mockPostCommitmentSignatureForTransaction(...args),
}));

vi.mock("../../src/utils/evmTransaction", () => ({
    assertTransactionSignerProvider: (signer: { provider: unknown }) =>
        signer.provider,
    sendPopulatedTransaction: (...args: unknown[]) =>
        mockSendPopulatedTransaction(...args),
}));

vi.mock("../../src/utils/provider", () => ({
    createAssetProvider: vi.fn(() => ({
        getLogs: vi.fn(),
    })),
}));

vi.mock("../../src/utils/oft/registry", () => ({
    getOftContract: vi.fn((route: { from: string }) =>
        Promise.resolve({
            address:
                route.from === "SRC"
                    ? "0x1111111111111111111111111111111111111111"
                    : "0x2222222222222222222222222222222222222222",
        }),
    ),
}));

vi.mock("../../src/utils/oft/solana", () => ({
    getSolanaOftGuidFromLogs: vi.fn().mockReturnValue("0xguid"),
}));

vi.mock("../../src/utils/oft/oft", () => ({
    createOftContract: vi.fn((address: string) => ({ address })),
    getOftProvider: vi.fn(() => ({
        getTransactionReceipt: vi.fn().mockResolvedValue({
            logs: [],
            blockNumber: 1,
        }),
    })),
    getOftReceivedEventByGuid: vi.fn().mockResolvedValue({
        amountReceivedLD: 150n,
        blockNumber: 5,
    }),
    getOftSentEvent: vi.fn().mockReturnValue({
        guid: "0xguid",
    }),
}));

vi.mock("../../src/utils/qouter", () => ({
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

describe("SwapExecutionWorker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNetworkTransport = "evm";
        mockGetTransaction.mockReset();
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
            oft: {
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
                    oft: expect.objectContaining({
                        txHash: undefined,
                    }),
                }),
            );
        });

        expect(mockSetSwapStorage).toHaveBeenCalledWith(
            expect.objectContaining({
                oft: expect.objectContaining({
                    txHash: undefined,
                }),
            }),
        );
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
