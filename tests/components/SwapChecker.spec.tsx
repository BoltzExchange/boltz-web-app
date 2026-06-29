import { render, waitFor } from "@solidjs/testing-library";
import { SwapType } from "boltz-swaps/types";
import log from "loglevel";
import { vi } from "vitest";

const h = vi.hoisted(() => {
    const handlers = new Map<string, (update: unknown) => void>();
    const unsubscribe = vi.fn();
    const close = vi.fn();
    const subscribe = vi.fn(
        (id: string, onUpdate: (update: unknown) => void) => {
            handlers.set(id, onUpdate);
            return unsubscribe;
        },
    );
    return {
        handlers,
        unsubscribe,
        close,
        subscribe,
        getSwap: vi.fn(),
        getSwaps: vi.fn(),
        updateSwapStatus: vi.fn(),
        claimSwap: vi.fn(),
        setSwap: vi.fn(),
        setSwapStatus: vi.fn(),
        setSwapStatusTransaction: vi.fn(),
        setFailureReason: vi.fn(),
        shouldIgnoreBackendStatus: vi.fn(() => false),
        swap: vi.fn(() => null),
        notifyParent: vi.fn(),
    };
});

vi.mock("boltz-swaps/statusSource", () => ({
    createDefaultStatusSource: () => ({
        subscribe: h.subscribe,
        close: h.close,
    }),
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        getSwap: h.getSwap,
        getSwaps: h.getSwaps,
        updateSwapStatus: h.updateSwapStatus,
    }),
}));

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        swap: h.swap,
        setSwap: h.setSwap,
        claimSwap: h.claimSwap,
        setSwapStatus: h.setSwapStatus,
        setSwapStatusTransaction: h.setSwapStatusTransaction,
        setFailureReason: h.setFailureReason,
        shouldIgnoreBackendStatus: h.shouldIgnoreBackendStatus,
    }),
}));

vi.mock("../../src/utils/notifyParent", () => ({
    useParentNotifier: () => ({ notifyParent: h.notifyParent }),
}));

const { SwapChecker } = await import("../../src/components/SwapChecker");

const swapA = { id: "A", type: SwapType.Reverse, status: "swap.created" };

describe("SwapChecker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.handlers.clear();
        h.swap.mockReturnValue(null);
        h.shouldIgnoreBackendStatus.mockReturnValue(false);
        h.updateSwapStatus.mockResolvedValue(undefined);
        h.claimSwap.mockResolvedValue(undefined);
        Object.defineProperty(window.navigator, "locks", {
            configurable: true,
            value: {
                request: vi.fn(
                    async (_name: string, callback: () => Promise<unknown>) =>
                        await callback(),
                ),
            },
        });
    });

    test("retries prepareSwap on a later delivery when the swap was not yet persisted", async () => {
        h.getSwaps.mockResolvedValue([swapA]);
        h.getSwap.mockResolvedValue(null);

        render(() => <SwapChecker />);
        await waitFor(() =>
            expect(h.subscribe).toHaveBeenCalledWith("A", expect.any(Function)),
        );
        const handler = h.handlers.get("A")!;

        const update = { id: "A", status: "transaction.mempool" };
        handler(update);

        await waitFor(() => expect(h.claimSwap).toHaveBeenCalledTimes(1));
        expect(h.updateSwapStatus).not.toHaveBeenCalled();

        h.getSwap.mockResolvedValue(swapA);
        handler(update);

        await waitFor(() =>
            expect(h.updateSwapStatus).toHaveBeenCalledWith(
                "A",
                "transaction.mempool",
            ),
        );
        expect(h.claimSwap).toHaveBeenCalledTimes(2);
    });

    test("runs prepareSwap and claims on every delivery (de-dup is the source's job)", async () => {
        h.getSwaps.mockResolvedValue([swapA]);
        h.getSwap.mockResolvedValue(swapA);

        render(() => <SwapChecker />);
        await waitFor(() => expect(h.subscribe).toHaveBeenCalled());
        const handler = h.handlers.get("A")!;

        handler({ id: "A", status: "transaction.mempool" });
        await waitFor(() =>
            expect(h.updateSwapStatus).toHaveBeenCalledTimes(1),
        );
        expect(h.claimSwap).toHaveBeenCalledTimes(1);

        handler({ id: "A", status: "transaction.mempool" });
        await waitFor(() =>
            expect(h.updateSwapStatus).toHaveBeenCalledTimes(2),
        );
        expect(h.claimSwap).toHaveBeenCalledTimes(2);
    });

    test("closes the source on cleanup", async () => {
        h.getSwaps.mockResolvedValue([swapA]);
        h.getSwap.mockResolvedValue(swapA);

        const { unmount } = render(() => <SwapChecker />);
        await waitFor(() => expect(h.subscribe).toHaveBeenCalledTimes(1));

        unmount();

        expect(h.close).toHaveBeenCalledTimes(1);
        expect(h.unsubscribe).not.toHaveBeenCalled();
    });

    test("logs a rejected claimSwap instead of leaking an unhandled rejection", async () => {
        const errorSpy = vi.spyOn(log, "error").mockImplementation(() => {});
        h.getSwaps.mockResolvedValue([swapA]);
        h.getSwap.mockResolvedValue(swapA);
        h.claimSwap.mockRejectedValue(new Error("claim boom"));

        render(() => <SwapChecker />);
        await waitFor(() => expect(h.subscribe).toHaveBeenCalled());

        h.handlers.get("A")!({ id: "A", status: "transaction.mempool" });

        await waitFor(() =>
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining("claimSwap failed for swap A"),
                expect.any(Error),
            ),
        );
        errorSpy.mockRestore();
    });
});
