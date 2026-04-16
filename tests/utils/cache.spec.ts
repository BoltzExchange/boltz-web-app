import { afterEach, describe, expect, test, vi } from "vitest";

import { clearCache, getCachedValue } from "../../src/utils/cache";

const createDeferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return {
        promise,
        reject,
        resolve,
    };
};

describe("cache", () => {
    afterEach(() => {
        clearCache();
    });

    describe("synchronous values", () => {
        test("should cache by default", () => {
            const createValue = vi.fn(() => ({ value: 1 }));

            const first = getCachedValue("sync:", "key", createValue);
            const second = getCachedValue("sync:", "key", createValue);

            expect(first).toBe(second);
            expect(createValue).toHaveBeenCalledTimes(1);
        });

        test("should not retain when shouldRetain returns false", () => {
            const createValue = vi.fn(() => ({ value: 1 }));

            const first = getCachedValue("sync:", "ephemeral", createValue, {
                shouldRetain: () => false,
            });
            const second = getCachedValue("sync:", "ephemeral", createValue, {
                shouldRetain: () => false,
            });

            expect(first).toEqual({ value: 1 });
            expect(second).toEqual({ value: 1 });
            expect(first).not.toBe(second);
            expect(createValue).toHaveBeenCalledTimes(2);
        });

        test("should retain when shouldRetain returns true", () => {
            const createValue = vi.fn(() => ({ value: 1 }));

            const first = getCachedValue("sync:", "retained", createValue, {
                shouldRetain: () => true,
            });
            const second = getCachedValue("sync:", "retained", createValue, {
                shouldRetain: () => false,
            });

            expect(first).toBe(second);
            expect(createValue).toHaveBeenCalledTimes(1);
        });
    });

    describe("async values", () => {
        test("should cache resolved values by default", async () => {
            const createValue = vi.fn(() => Promise.resolve("cached"));

            await expect(
                getCachedValue("async:", "key", createValue),
            ).resolves.toBe("cached");
            await expect(
                getCachedValue("async:", "key", createValue),
            ).resolves.toBe("cached");

            expect(createValue).toHaveBeenCalledTimes(1);
        });

        test("should not retain when shouldRetain returns false", async () => {
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

        test("should retain when shouldRetain returns true", async () => {
            const createValue = vi.fn(() => Promise.resolve("retained"));

            await expect(
                getCachedValue("async:", "retained", createValue, {
                    shouldRetain: () => true,
                }),
            ).resolves.toBe("retained");
            await expect(
                getCachedValue("async:", "retained", createValue, {
                    shouldRetain: () => true,
                }),
            ).resolves.toBe("retained");

            expect(createValue).toHaveBeenCalledTimes(1);
        });

        test("should pass the resolved value to shouldRetain", async () => {
            const shouldRetain = vi.fn(() => true);
            const createValue = vi.fn(() => Promise.resolve("the-value"));

            await getCachedValue("async:", "inspect", createValue, {
                shouldRetain,
            });

            expect(shouldRetain).toHaveBeenCalledTimes(1);
            expect(shouldRetain).toHaveBeenCalledWith("the-value");
        });

        test("should dedupe in-flight values then evict when shouldRetain returns false", async () => {
            const deferred = createDeferred<string>();
            const createValue = vi
                .fn<() => Promise<string>>()
                .mockImplementationOnce(() => deferred.promise)
                .mockImplementationOnce(() => Promise.resolve("fresh"));

            const first = getCachedValue("async:", "pending", createValue, {
                shouldRetain: () => false,
            });
            const second = getCachedValue("async:", "pending", createValue, {
                shouldRetain: () => false,
            });

            expect(first).toBe(second);
            expect(createValue).toHaveBeenCalledTimes(1);

            deferred.resolve("original");

            await expect(first).resolves.toBe("original");
            await expect(second).resolves.toBe("original");

            await expect(
                getCachedValue("async:", "pending", createValue, {
                    shouldRetain: () => false,
                }),
            ).resolves.toBe("fresh");
            expect(createValue).toHaveBeenCalledTimes(2);
        });

        test("should remove rejected values so they can be retried", async () => {
            const deferred = createDeferred<string>();
            const createValue = vi
                .fn<() => Promise<string>>()
                .mockImplementationOnce(() => deferred.promise)
                .mockImplementationOnce(() => Promise.resolve("recovered"));

            const first = getCachedValue("async:", "retry", createValue);
            const second = getCachedValue("async:", "retry", createValue);

            expect(first).toBe(second);
            expect(createValue).toHaveBeenCalledTimes(1);

            deferred.reject(new Error("boom"));

            await expect(first).rejects.toThrow("boom");
            await expect(second).rejects.toThrow("boom");

            await expect(
                getCachedValue("async:", "retry", createValue),
            ).resolves.toBe("recovered");
            expect(createValue).toHaveBeenCalledTimes(2);
        });
    });

    describe("key isolation", () => {
        test("should treat different prefixes and keys as separate entries", () => {
            const createValue = vi.fn(() => ({ value: 1 }));

            const first = getCachedValue("sync:", "key-a", createValue);
            const second = getCachedValue("sync:", "key-b", createValue);
            const third = getCachedValue("other:", "key-a", createValue);

            expect(first).not.toBe(second);
            expect(first).not.toBe(third);
            expect(second).not.toBe(third);
            expect(createValue).toHaveBeenCalledTimes(3);
        });
    });

    describe("clearCache", () => {
        test("should invalidate both sync and async entries", async () => {
            const createSyncValue = vi.fn(() => ({ value: 1 }));
            const createAsyncValue = vi.fn(() => Promise.resolve("cached"));

            const firstSync = getCachedValue("sync:", "key", createSyncValue);
            await expect(
                getCachedValue("async:", "key", createAsyncValue),
            ).resolves.toBe("cached");

            clearCache();

            const secondSync = getCachedValue("sync:", "key", createSyncValue);
            await expect(
                getCachedValue("async:", "key", createAsyncValue),
            ).resolves.toBe("cached");

            expect(firstSync).not.toBe(secondSync);
            expect(createSyncValue).toHaveBeenCalledTimes(2);
            expect(createAsyncValue).toHaveBeenCalledTimes(2);
        });
    });
});
