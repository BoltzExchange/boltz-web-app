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
        [-1, false],
        ["-1", false],
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
});
