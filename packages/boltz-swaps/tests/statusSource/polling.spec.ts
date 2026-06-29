import { vi } from "vitest";

import {
    type SwapUpdate,
    createPollingStatusSource,
} from "../../src/statusSource/index.ts";

const mocks = vi.hoisted(() => ({
    getSwapStatuses: vi.fn(),
    getSwapStatus: vi.fn(),
}));

vi.mock("../../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof import("../../src/client.ts")>()),
    getSwapStatuses: mocks.getSwapStatuses,
    getSwapStatus: mocks.getSwapStatus,
}));

const statuses = (updates: SwapUpdate[]): string[] =>
    updates.map((update) => update.status);

beforeEach(() => {
    mocks.getSwapStatuses.mockReset();
    mocks.getSwapStatus.mockReset();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("createPollingStatusSource", () => {
    test("emits immediately and only re-emits on a status change", async () => {
        mocks.getSwapStatuses
            .mockResolvedValueOnce({ a: { status: "swap.created" } })
            .mockResolvedValueOnce({ a: { status: "swap.created" } })
            .mockResolvedValueOnce({ a: { status: "transaction.mempool" } });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (update) => seen.push(update));

        await vi.advanceTimersByTimeAsync(0);
        expect(seen).toEqual([{ id: "a", status: "swap.created" }]);

        await vi.advanceTimersByTimeAsync(1_000);
        expect(statuses(seen)).toEqual(["swap.created"]);

        await vi.advanceTimersByTimeAsync(1_000);
        expect(statuses(seen)).toEqual(["swap.created", "transaction.mempool"]);
    });

    test("keeps polling every interval but emits only on change", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "transaction.mempool" },
        });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));

        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(1_000);
        await vi.advanceTimersByTimeAsync(1_000);

        expect(mocks.getSwapStatuses.mock.calls.length).toBeGreaterThanOrEqual(
            3,
        );
        expect(seen).toEqual([{ id: "a", status: "transaction.mempool" }]);

        source.close?.();
    });

    test("re-emits to a fresh subscribe after the previous one unsubscribed", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "transaction.mempool" },
        });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const first: SwapUpdate[] = [];
        const unsubscribe = source.subscribe("a", (u) => first.push(u));

        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(first).toHaveLength(1);

        unsubscribe();

        const second: SwapUpdate[] = [];
        source.subscribe("a", (u) => second.push(u));
        await vi.advanceTimersByTimeAsync(0);
        expect(second).toEqual([{ id: "a", status: "transaction.mempool" }]);

        source.close?.();
    });

    test("re-subscribing the same handler does not replay the current status", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "transaction.mempool" },
        });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const seen: SwapUpdate[] = [];
        const handler = (u: SwapUpdate): void => {
            seen.push(u);
        };
        source.subscribe("a", handler);
        await vi.advanceTimersByTimeAsync(0);
        expect(seen).toHaveLength(1);

        source.subscribe("a", handler);
        expect(seen).toHaveLength(1);

        source.close?.();
    });

    test("fetches every tracked id in a single bulk request", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "swap.created" },
            b: { status: "invoice.set" },
        });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const a: SwapUpdate[] = [];
        const b: SwapUpdate[] = [];
        source.subscribe("a", (u) => a.push(u));
        source.subscribe("b", (u) => b.push(u));

        await vi.advanceTimersByTimeAsync(0);

        expect(mocks.getSwapStatuses).toHaveBeenCalledTimes(1);
        expect(mocks.getSwapStatuses).toHaveBeenCalledWith(["a", "b"]);
        expect(mocks.getSwapStatus).not.toHaveBeenCalled();
        expect(a).toEqual([{ id: "a", status: "swap.created" }]);
        expect(b).toEqual([{ id: "b", status: "invoice.set" }]);
    });

    test("falls back to per-id fetches when the bulk request fails", async () => {
        mocks.getSwapStatuses.mockRejectedValue(
            new Error("could not find swap with id: b"),
        );
        mocks.getSwapStatus.mockImplementation(async (id: string) => {
            if (id === "b") {
                throw new Error("not found");
            }
            return { status: "swap.created" };
        });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const a: SwapUpdate[] = [];
        const bErrors: unknown[] = [];
        source.subscribe("a", (u) => a.push(u));
        source.subscribe(
            "b",
            () => {},
            (error) => bErrors.push(error),
        );

        await vi.advanceTimersByTimeAsync(0);

        expect(a).toEqual([{ id: "a", status: "swap.created" }]);
        expect(bErrors).toHaveLength(1);
    });

    test("replays current status to a late joiner and stops on last unsubscribe", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            x: { status: "invoice.set" },
        });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const first: SwapUpdate[] = [];
        const second: SwapUpdate[] = [];
        const unsubscribeFirst = source.subscribe("x", (u) => first.push(u));
        await vi.advanceTimersByTimeAsync(0);

        const unsubscribeSecond = source.subscribe("x", (u) => second.push(u));
        expect(second).toEqual([{ id: "x", status: "invoice.set" }]);

        const callsAfterJoin = mocks.getSwapStatuses.mock.calls.length;
        unsubscribeFirst();
        unsubscribeSecond();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(mocks.getSwapStatuses.mock.calls.length).toBe(callsAfterJoin);
    });

    test("a subscribe after close() is a no-op and never revives the loop", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "swap.created" },
        });
        const source = createPollingStatusSource({ intervalMs: 1_000 });
        source.close?.();

        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        await vi.advanceTimersByTimeAsync(5_000);

        expect(mocks.getSwapStatuses).not.toHaveBeenCalled();
        expect(seen).toEqual([]);
    });

    test("coalesces a subscribe that lands while a poll is in flight", async () => {
        let resolveFirst: (
            value: Record<string, { status: string }>,
        ) => void = () => {};
        mocks.getSwapStatuses
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveFirst = resolve;
                    }),
            )
            .mockResolvedValue({ a: { status: "x" }, b: { status: "y" } });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        source.subscribe("a", () => {});
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.getSwapStatuses).toHaveBeenCalledTimes(1);
        expect(mocks.getSwapStatuses).toHaveBeenNthCalledWith(1, ["a"]);

        source.subscribe("b", () => {});
        resolveFirst({ a: { status: "x" } });
        await vi.advanceTimersByTimeAsync(0);

        expect(mocks.getSwapStatuses).toHaveBeenCalledTimes(2);
        expect(mocks.getSwapStatuses).toHaveBeenNthCalledWith(2, ["a", "b"]);
    });

    test("fans every poll out to all handlers of an id", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "swap.created" },
        });
        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const h1: SwapUpdate[] = [];
        const h2: SwapUpdate[] = [];
        source.subscribe("a", (u) => h1.push(u));
        source.subscribe("a", (u) => h2.push(u));

        await vi.advanceTimersByTimeAsync(0);

        expect(h1).toEqual([{ id: "a", status: "swap.created" }]);
        expect(h2).toEqual([{ id: "a", status: "swap.created" }]);
    });

    test("isolates a throwing handler so the others still receive the poll", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "swap.created" },
        });
        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const good: SwapUpdate[] = [];
        source.subscribe("a", () => {
            throw new Error("boom");
        });
        source.subscribe("a", (u) => good.push(u));

        await vi.advanceTimersByTimeAsync(0);

        expect(good).toEqual([{ id: "a", status: "swap.created" }]);
    });

    test("skips an id absent from a successful bulk response (no update, no error)", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            a: { status: "swap.created" },
        });
        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const a: SwapUpdate[] = [];
        const b: SwapUpdate[] = [];
        const bErrors: unknown[] = [];
        source.subscribe("a", (u) => a.push(u));
        source.subscribe(
            "b",
            (u) => b.push(u),
            (error) => bErrors.push(error),
        );

        await vi.advanceTimersByTimeAsync(0);

        expect(a).toEqual([{ id: "a", status: "swap.created" }]);
        expect(b).toEqual([]);
        expect(bErrors).toEqual([]);
    });

    test("re-emits when a non-status field changes but the status does not", async () => {
        mocks.getSwapStatuses
            .mockResolvedValueOnce({
                a: {
                    status: "transaction.mempool",
                    transaction: { id: "tx1" },
                },
            })
            .mockResolvedValueOnce({
                a: {
                    status: "transaction.mempool",
                    transaction: { id: "tx2" },
                },
            });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));

        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(1_000);

        expect(seen).toEqual([
            {
                id: "a",
                status: "transaction.mempool",
                transaction: { id: "tx1" },
            },
            {
                id: "a",
                status: "transaction.mempool",
                transaction: { id: "tx2" },
            },
        ]);

        source.close?.();
    });

    test("re-subscribing the same handler still delivers a later update only once", async () => {
        mocks.getSwapStatuses
            .mockResolvedValueOnce({ a: { status: "swap.created" } })
            .mockResolvedValue({ a: { status: "transaction.mempool" } });

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const seen: SwapUpdate[] = [];
        const handler = (u: SwapUpdate): void => {
            seen.push(u);
        };
        source.subscribe("a", handler);
        await vi.advanceTimersByTimeAsync(0);
        source.subscribe("a", handler);

        await vi.advanceTimersByTimeAsync(1_000);

        expect(statuses(seen)).toEqual(["swap.created", "transaction.mempool"]);

        source.close?.();
    });

    test("normalizes a non-Error rejection into an Error for onError", async () => {
        mocks.getSwapStatuses.mockRejectedValue("bulk down");
        mocks.getSwapStatus.mockRejectedValue("string failure");

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const errors: unknown[] = [];
        source.subscribe(
            "a",
            () => {},
            (error) => errors.push(error),
        );

        await vi.advanceTimersByTimeAsync(0);

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(Error);
        expect((errors[0] as Error).message).toBe("string failure");

        source.close?.();
    });

    test("isolates a throwing error handler so the others still receive the error", async () => {
        mocks.getSwapStatuses.mockRejectedValue(new Error("bulk down"));
        mocks.getSwapStatus.mockRejectedValue(new Error("boom"));

        const source = createPollingStatusSource({ intervalMs: 1_000 });
        const good: unknown[] = [];
        source.subscribe(
            "a",
            () => {},
            () => {
                throw new Error("handler exploded");
            },
        );
        source.subscribe(
            "a",
            () => {},
            (error) => good.push(error),
        );

        await vi.advanceTimersByTimeAsync(0);

        expect(good).toHaveLength(1);
        expect(good[0]).toBeInstanceOf(Error);

        source.close?.();
    });
});
