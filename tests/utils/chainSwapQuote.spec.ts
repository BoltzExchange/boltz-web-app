import { describe, expect, test, vi } from "vitest";

import {
    isPositivePersistedAmount,
    withChainSwapQuoteLock,
} from "../../src/utils/chainSwapQuote";

describe("isPositivePersistedAmount", () => {
    test.each([
        [991, true],
        ["991", true],
        [0, false],
        ["0", false],
        [undefined, false],
        ["not-a-number", false],
    ])("returns %s -> %s", (amount, expected) => {
        expect(isPositivePersistedAmount(amount)).toBe(expected);
    });
});

describe("withChainSwapQuoteLock", () => {
    test("uses one stable browser lock name per swap", async () => {
        const request = vi.fn(
            async (_name: string, fn: () => Promise<string>) => await fn(),
        );
        const originalLocks = navigator.locks;
        Object.defineProperty(navigator, "locks", {
            configurable: true,
            value: { request },
        });

        try {
            await expect(
                withChainSwapQuoteLock("swap-1", () => Promise.resolve("done")),
            ).resolves.toBe("done");
            expect(request).toHaveBeenCalledWith(
                "chainSwapReplacementQuote:swap-1",
                expect.any(Function),
            );
        } finally {
            Object.defineProperty(navigator, "locks", {
                configurable: true,
                value: originalLocks,
            });
        }
    });

    // navigator.locks does not exist in the test environment, so these
    // exercise the same-tab fallback queue.
    test("serializes callers of the same swap", async () => {
        const order: string[] = [];
        let releaseFirst!: () => void;
        const firstPending = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });

        const first = withChainSwapQuoteLock("swap-1", async () => {
            order.push("first:start");
            await firstPending;
            order.push("first:end");
        });
        const second = withChainSwapQuoteLock("swap-1", () => {
            order.push("second");
            return Promise.resolve();
        });
        const otherSwap = withChainSwapQuoteLock("swap-2", () => {
            order.push("other-swap");
            return Promise.resolve();
        });

        await otherSwap;
        expect(order).toEqual(["first:start", "other-swap"]);

        releaseFirst();
        await Promise.all([first, second]);
        expect(order).toEqual([
            "first:start",
            "other-swap",
            "first:end",
            "second",
        ]);
    });

    test("keeps processing the queue after a rejection", async () => {
        await expect(
            withChainSwapQuoteLock("swap-1", () =>
                Promise.reject(new Error("accept failed")),
            ),
        ).rejects.toThrow("accept failed");

        await expect(
            withChainSwapQuoteLock("swap-1", () =>
                Promise.resolve("recovered"),
            ),
        ).resolves.toBe("recovered");
    });
});
