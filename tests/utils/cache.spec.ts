import { afterEach, expect, test, vi } from "vitest";

import { clearCache, getCachedValue } from "../../src/utils/cache";

afterEach(() => {
    clearCache();
});

test("should cache synchronous values", () => {
    const createValue = vi.fn(() => ({ value: 1 }));

    const first = getCachedValue("sync:", "key", createValue);
    const second = getCachedValue("sync:", "key", createValue);

    expect(first).toBe(second);
    expect(createValue).toHaveBeenCalledTimes(1);
});

test("should dedupe async values while they are in flight", async () => {
    const createValue = vi.fn(() => Promise.resolve("cached"));

    const [first, second] = await Promise.all([
        getCachedValue("async:", "key", createValue, {
            shouldRetain: () => false,
        }),
        getCachedValue("async:", "key", createValue, {
            shouldRetain: () => false,
        }),
    ]);

    expect(first).toBe("cached");
    expect(second).toBe("cached");
    expect(createValue).toHaveBeenCalledTimes(1);
});

test("should not retain async values when shouldRetain returns false", async () => {
    const createValue = vi.fn(() => Promise.resolve("ephemeral"));

    await expect(
        getCachedValue("async:", "ephemeral", createValue, {
            shouldRetain: () => false,
        }),
    ).resolves.toBe("ephemeral");
    await expect(
        getCachedValue("async:", "ephemeral", createValue, {
            shouldRetain: () => false,
        }),
    ).resolves.toBe("ephemeral");

    expect(createValue).toHaveBeenCalledTimes(2);
});
