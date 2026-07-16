import { render } from "@solidjs/testing-library";
import { SwapType } from "boltz-swaps/types";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { swapStatusPending } from "../../src/consts/SwapStatus";
import type { PayContextType } from "../../src/context/Pay";
import { withChainSwapQuoteLock } from "../../src/utils/chainSwapQuote";
import type { ChainSwap, SomeSwap } from "../../src/utils/swapCreator";

const getSwap = vi.fn<(id: string) => Promise<SomeSwap | null>>();
const getSwaps = vi.fn((): Promise<SomeSwap[]> => Promise.resolve([]));
const notify = vi.fn();
const deriveKey = vi.fn();
const modifySwapStorage = vi.fn();
const fetchPairs = vi.fn();
const pairs = vi.fn();
const claim =
    vi.fn<(...args: unknown[]) => Promise<{ id: string; claimTx: string }>>();

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string) => key,
        deriveKey,
        getSwap,
        getSwaps,
        privacyMode: () => false,
        notify,
        fetchPairs,
        pairs,
        modifySwapStorage,
        zeroConf: () => false,
    }),
}));

vi.mock("../../src/utils/claim", () => ({
    claim: (...args: unknown[]) => claim(...args),
    createSubmarineSignature: vi.fn(),
    createTheirPartialChainSwapSignature: vi.fn(),
    findSwapOutputVout: vi.fn(),
}));

vi.mock("../../src/utils/compat", () => ({
    decodeAddress: () => ({
        script: Buffer.from(
            "0014751e76e8199196d454941c45d1b3a323f1433bd6",
            "hex",
        ),
    }),
    findOutputByScript: () => ({
        amount: 5_000,
        script: Buffer.from(
            "0014751e76e8199196d454941c45d1b3a323f1433bd6",
            "hex",
        ),
    }),
}));

const { PayProvider, usePayContext } = await import("../../src/context/Pay");

const staleSwap = {
    id: "swap-1",
    type: SwapType.Chain,
    assetSend: "L-BTC",
    assetReceive: "BTC",
    receiveAmount: 0,
} as unknown as ChainSwap;
const freshSwap = { ...staleSwap, receiveAmount: 991 } as ChainSwap;

const claimData = {
    id: "swap-1",
    status: swapStatusPending.TransactionServerConfirmed,
    transaction: { hex: "0xlockup" },
};

const lockQueues = new Map<string, Promise<unknown>>();
const requestLock = <T,>(name: string, callback: () => Promise<T>) => {
    const previous = lockQueues.get(name) ?? Promise.resolve();
    const current = previous.then(callback);
    lockQueues.set(
        name,
        current.catch(() => undefined),
    );
    return current;
};

const renderPayContext = () => {
    let context!: PayContextType;
    const Child = () => {
        context = usePayContext();
        return null;
    };
    render(() => (
        <PayProvider>
            <Child />
        </PayProvider>
    ));
    return context;
};

describe("PayProvider claimSwap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        lockQueues.clear();
        Object.defineProperty(navigator, "locks", {
            configurable: true,
            value: { request: vi.fn(requestLock) },
        });
        pairs.mockReturnValue(undefined);
        claim.mockResolvedValue({ id: "swap-1", claimTx: "0xclaimed" });
        modifySwapStorage.mockImplementation(
            (_id: string, mutator: (swap: SomeSwap) => void) => {
                const swap = { ...freshSwap };
                mutator(swap);
                return Promise.resolve(swap);
            },
        );
    });

    test("fetches missing pair data and recovers a zero-amount claim from the server lockup", async () => {
        // The tx pays 5_000 sats to the address
        const lockupAddress = "bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080";
        const serverLockupHex =
            "020000000100000000000000000000000000000000000000000000000000000000000000000000000000ffffffff018813000000000000160014751e76e8199196d454941c45d1b3a323f1433bd600000000";

        const lostSwap = {
            ...staleSwap,
            claimDetails: { amount: 0, lockupAddress },
        } as unknown as ChainSwap;
        getSwap.mockResolvedValue(lostSwap);
        modifySwapStorage.mockImplementation(
            (_id: string, mutator: (swap: SomeSwap) => void) => {
                const swap = {
                    ...lostSwap,
                    claimDetails: { ...lostSwap.claimDetails },
                };
                mutator(swap);
                return Promise.resolve(swap);
            },
        );
        const lostClaimData = {
            ...claimData,
            transaction: { hex: serverLockupHex },
        };
        const pairData = {
            [SwapType.Chain]: {
                "L-BTC": {
                    BTC: { fees: { minerFees: { user: { claim: 100 } } } },
                },
            },
        };
        pairs.mockImplementation(() =>
            fetchPairs.mock.calls.length === 0 ? undefined : pairData,
        );
        fetchPairs.mockResolvedValue(undefined);

        const context = renderPayContext();
        await context.claimSwap("swap-1", lostClaimData);

        expect(fetchPairs).toHaveBeenCalledTimes(1);
        expect(claim).toHaveBeenCalledTimes(1);
        const claimedSwap = claim.mock.calls[0][1] as ChainSwap;
        expect(claimedSwap.receiveAmount).toBe(5_000 - 101);
        expect(claimedSwap.claimDetails.amount).toBe(5_000);
        expect(notify).toHaveBeenCalledWith("success", "swap_completed");
    });

    test("waits for an in-flight replacement quote acceptance before claiming", async () => {
        let persisted: ChainSwap = staleSwap;
        getSwap.mockImplementation(() => Promise.resolve(persisted));

        // Simulate TransactionLockupFailed accepting a replacement quote:
        // it holds the quote lock across backend accept + local persistence.
        let finishAcceptance!: () => void;
        const acceptancePending = new Promise<void>((resolve) => {
            finishAcceptance = resolve;
        });
        const acceptance = withChainSwapQuoteLock("swap-1", async () => {
            await acceptancePending;
            persisted = freshSwap;
        });

        const context = renderPayContext();
        const claiming = context.claimSwap("swap-1", claimData);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(claim).not.toHaveBeenCalled();

        finishAcceptance();
        await acceptance;
        await claiming;

        expect(claim).toHaveBeenCalledTimes(1);
        expect((claim.mock.calls[0][1] as ChainSwap).receiveAmount).toBe(991);
        expect(notify).toHaveBeenCalledWith("success", "swap_completed");
    });

    test("keeps replacement quote acceptance blocked until the claim is persisted", async () => {
        getSwap.mockResolvedValue(freshSwap);

        let finishClaim!: () => void;
        const claimPending = new Promise<void>((resolve) => {
            finishClaim = resolve;
        });
        claim.mockImplementation(async () => {
            await claimPending;
            return { id: "swap-1", claimTx: "0xclaimed" };
        });

        const context = renderPayContext();
        const claiming = context.claimSwap("swap-1", claimData);
        await vi.waitFor(() => expect(claim).toHaveBeenCalledTimes(1));

        const acceptance = vi.fn();
        const accepting = withChainSwapQuoteLock("swap-1", () => {
            acceptance();
            return Promise.resolve();
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(acceptance).not.toHaveBeenCalled();

        finishClaim();
        await claiming;
        await accepting;

        expect(modifySwapStorage).toHaveBeenCalled();
        expect(acceptance).toHaveBeenCalledTimes(1);
    });
});
