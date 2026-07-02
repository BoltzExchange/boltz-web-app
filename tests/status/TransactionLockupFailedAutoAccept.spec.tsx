import { render, waitFor } from "@solidjs/testing-library";
import { SwapPosition, SwapType } from "boltz-swaps/types";

const mocks = vi.hoisted(() => ({
    swap: undefined as unknown,
    setSwap: vi.fn((nextSwap: unknown) => {
        mocks.swap = nextSwap;
    }),
    modifySwapStorage: vi.fn(
        async (
            _id: string,
            mutator: (s: unknown) => void | Promise<void>,
        ): Promise<unknown> => {
            await mutator(mocks.swap);
            return mocks.swap;
        },
    ),
    setFailureReason: vi.fn(),
    setStatusOverride: vi.fn(),
    acceptChainSwapNewQuote: vi.fn().mockResolvedValue(undefined),
    getChainSwapNewQuote: vi.fn(),
    getChainSwapTransactions: vi.fn().mockResolvedValue({
        userLock: {
            transaction: {},
        },
    }),
    fetchPairs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("boltz-swaps/client", () => ({
    acceptChainSwapNewQuote: mocks.acceptChainSwapNewQuote,
    getChainSwapNewQuote: mocks.getChainSwapNewQuote,
    getChainSwapTransactions: mocks.getChainSwapTransactions,
}));

vi.mock("../../src/components/RefundButton", () => ({
    default: () => <button>refund</button>,
    incorrectAssetError: "incorrect asset was sent",
}));

vi.mock("../../src/components/LoadingSpinner", () => ({
    default: () => <div>loading</div>,
}));

vi.mock("../../src/pages/NotFound", () => ({
    default: () => <div>not-found</div>,
}));

vi.mock("../../src/consts/Assets", () => ({
    isEvmAsset: () => true,
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string) => key,
        fetchPairs: mocks.fetchPairs,
        modifySwapStorage: mocks.modifySwapStorage,
        pairs: () => ({
            chain: {
                FINAL: {
                    BTC: {
                        fees: {
                            minerFees: {
                                user: {
                                    claim: 0,
                                },
                            },
                        },
                    },
                },
            },
        }),
        slippage: () => 0.01,
        denomination: () => "sat",
        separator: () => ".",
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        failureReason: () => "",
        swap: () => mocks.swap,
        setSwap: mocks.setSwap,
        setFailureReason: mocks.setFailureReason,
    }),
}));

vi.mock("../../src/utils/Pair", () => ({
    default: class MockPair {
        isRoutable = false;
    },
}));

vi.mock("../../src/utils/compat", () => ({
    decodeAddress: vi.fn(),
    findOutputByScript: vi.fn(),
    getOutputAmount: vi.fn(),
    getTransaction: vi.fn(),
}));

vi.mock("../../src/utils/denomination", () => ({
    formatAmount: (amount: { toString: () => string }) => amount.toString(),
    formatDenomination: () => "sat",
    formatSwapAmountForLog: (amount: { toString: () => string }) =>
        amount.toString(),
    getDecimals: () => ({ isErc20: false, decimals: 8 }),
}));

vi.mock("../../src/utils/helper", () => ({
    parseBlindingKey: vi.fn(),
}));

vi.mock("../../src/utils/rescue", () => ({
    isRefundableSwapType: () => false,
}));

const { default: TransactionLockupFailed } =
    await import("../../src/status/TransactionLockupFailed");

const makeSwap = () => ({
    id: "swap-1",
    type: SwapType.Chain,
    assetSend: "FINAL",
    assetReceive: "BTC",
    sendAmount: 100,
    receiveAmount: 1_000,
    claimAddress: "claim",
    signer: "signer",
    claimDetails: {
        amount: 1_000,
    },
    dex: {
        position: SwapPosition.Pre,
        quoteAmount: "100",
        hops: [],
    },
});

describe("TransactionLockupFailed pre-bridge auto-accept", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.swap = makeSwap();
        mocks.getChainSwapNewQuote.mockResolvedValue({ amount: 991 });
    });

    test("auto-accepts a pre-bridge replacement quote within slippage", async () => {
        render(() => (
            <TransactionLockupFailed
                setStatusOverride={mocks.setStatusOverride}
            />
        ));

        await waitFor(() => {
            expect(mocks.acceptChainSwapNewQuote).toHaveBeenCalledWith(
                "swap-1",
                991,
            );
        });
        await waitFor(() => {
            expect(mocks.modifySwapStorage).toHaveBeenCalledWith(
                "swap-1",
                expect.any(Function),
            );
        });

        expect(
            mocks.acceptChainSwapNewQuote.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.modifySwapStorage.mock.invocationCallOrder[0]);
        expect(mocks.swap).toEqual(
            expect.objectContaining({
                receiveAmount: 990,
                claimDetails: expect.objectContaining({
                    amount: 991,
                }),
                dex: expect.objectContaining({
                    quoteAmount: 100,
                }),
            }),
        );
    });

    test("does not auto-accept a pre-bridge replacement quote outside slippage", async () => {
        mocks.getChainSwapNewQuote.mockResolvedValue({ amount: 990 });

        render(() => (
            <TransactionLockupFailed
                setStatusOverride={mocks.setStatusOverride}
            />
        ));

        await waitFor(() => {
            expect(mocks.setStatusOverride).toHaveBeenCalledWith(
                "quote.available",
            );
        });

        expect(mocks.acceptChainSwapNewQuote).not.toHaveBeenCalled();
        expect(mocks.modifySwapStorage).not.toHaveBeenCalled();
    });
});
