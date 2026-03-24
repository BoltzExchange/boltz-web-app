import { render, waitFor } from "@solidjs/testing-library";

let currentSwap: Record<string, unknown>;

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
        getErc20Swap: vi.fn(() => ({
            getAddress: vi
                .fn()
                .mockResolvedValue(
                    "0x8000000000000000000000000000000000000000",
                ),
            version: vi.fn().mockResolvedValue("2"),
        })),
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

vi.mock("../../src/utils/Pair", () => ({
    HopsPosition: {
        Before: "before",
        After: "after",
    },
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
}));

vi.mock("../../src/utils/calculate", () => ({
    calculateAmountOutMin: (amount: bigint) => amount,
    calculateAmountWithSlippage: (amount: bigint) => amount,
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

vi.mock("../../src/utils/oft/oft", () => ({
    createOftContract: vi.fn((address: string) => ({ address })),
    getOftContract: vi.fn((route: { from: string }) =>
        Promise.resolve({
            address:
                route.from === "SRC"
                    ? "0x1111111111111111111111111111111111111111"
                    : "0x2222222222222222222222222222222222222222",
        }),
    ),
    getOftProvider: vi.fn(() => ({
        getTransactionReceipt: vi.fn().mockResolvedValue({
            logs: [],
            blockNumber: 1,
        }),
    })),
    getOftReceivedEventByGuid: vi.fn().mockResolvedValue({
        amountReceivedLD: 150n,
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
            gasAbstraction: "signer",
            claimAddress: "0xc000000000000000000000000000000000000000",
            preimage: "11".repeat(32),
            lockupDetails: {
                timeoutBlockHeight: 144,
            },
            dex: {
                position: "before",
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
