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

    // navigator.locks does not exist in the test environment, so this
    // exercises the same-tab fallback queue.
    test("serializes callers of the same swap and keeps processing after a rejection", async () => {
        const order: string[] = [];
        let failFirst!: () => void;
        const firstPending = new Promise<void>((resolve) => {
            failFirst = resolve;
        });

        const first = withChainSwapQuoteLock("swap-1", async () => {
            order.push("first:start");
            await firstPending;
            throw new Error("accept failed");
        });
        const second = withChainSwapQuoteLock("swap-1", () => {
            order.push("second");
            return Promise.resolve("recovered");
        });
        const otherSwap = withChainSwapQuoteLock("swap-2", () => {
            order.push("other-swap");
            return Promise.resolve();
        });

        await otherSwap;
        expect(order).toEqual(["first:start", "other-swap"]);

        failFirst();
        await expect(first).rejects.toThrow("accept failed");
        await expect(second).resolves.toBe("recovered");
        expect(order).toEqual(["first:start", "other-swap", "second"]);
    });
});
