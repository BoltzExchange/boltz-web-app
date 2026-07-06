import {
    firstResolved,
    firstResolvedPreferring,
    promiseWithTimeout,
} from "../../src/util/promise.ts";

describe("firstResolved", () => {
    test("throws synchronously when given no promises", () => {
        expect(() => firstResolved([])).toThrow("no promises provided");
    });

    test("resolves with the first fulfilled promise even if others are pending or reject", async () => {
        const pending = new Promise<string>(() => {});
        const rejecting = Promise.reject(new Error("boom"));

        await expect(
            firstResolved([Promise.resolve("winner"), rejecting, pending]),
        ).resolves.toBe("winner");
    });

    test("resolves with the earliest fulfilled value when multiple resolve", async () => {
        await expect(
            firstResolved([Promise.resolve(1), Promise.resolve(2)]),
        ).resolves.toBe(1);
    });

    test("rejects with the last error only once every promise has rejected", async () => {
        const first = new Error("first");
        const last = new Error("last");

        await expect(
            firstResolved([Promise.reject(first), Promise.reject(last)]),
        ).rejects.toBe(last);
    });
});

describe("firstResolvedPreferring", () => {
    test("throws synchronously when given no promises", () => {
        expect(() => firstResolvedPreferring([], () => true)).toThrow(
            "no promises provided",
        );
    });

    test("resolves on a success that settles before any preferred error", async () => {
        await expect(
            firstResolvedPreferring(
                [Promise.resolve("ok"), Promise.reject(new Error("nope"))],
                () => true,
            ),
        ).resolves.toBe("ok");
    });

    test("rejects immediately with a preferred error while other promises are pending", async () => {
        const preferred = new Error("PREFERRED");

        await expect(
            firstResolvedPreferring(
                [Promise.reject(preferred), new Promise<string>(() => {})],
                (e) => e instanceof Error && e.message === "PREFERRED",
            ),
        ).rejects.toBe(preferred);
    });

    test("rejects with the preferred error even when it was not the last to reject", async () => {
        const preferred = new Error("PREFERRED");
        const other = new Error("other");
        const prefer = (e: unknown) =>
            e instanceof Error && e.message === "PREFERRED";

        await expect(
            firstResolvedPreferring(
                [Promise.reject(preferred), Promise.reject(other)],
                prefer,
            ),
        ).rejects.toBe(preferred);
    });

    test("rejects with the last error when none match the prefer predicate", async () => {
        const first = new Error("first");
        const last = new Error("last");

        await expect(
            firstResolvedPreferring(
                [Promise.reject(first), Promise.reject(last)],
                () => false,
            ),
        ).rejects.toBe(last);
    });

    test("keeps the first matching error when several satisfy the prefer predicate", async () => {
        const p1 = new Error("pref-1");
        const p2 = new Error("pref-2");
        const p3 = new Error("nope");
        const prefer = (e: unknown) =>
            e instanceof Error && e.message.startsWith("pref");

        await expect(
            firstResolvedPreferring(
                [Promise.reject(p1), Promise.reject(p2), Promise.reject(p3)],
                prefer,
            ),
        ).rejects.toBe(p1);
    });
});

describe("promiseWithTimeout", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("resolves with the underlying value and clears the timeout timer", async () => {
        const clearSpy = vi.spyOn(globalThis, "clearTimeout");

        const result = promiseWithTimeout(Promise.resolve("done"), 5000);
        expect(vi.getTimerCount()).toBe(1);

        await expect(result).resolves.toBe("done");

        expect(clearSpy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    test("rejects with the underlying error and clears the timeout timer", async () => {
        const err = new Error("underlying failure");

        const result = promiseWithTimeout(Promise.reject(err), 5000);
        expect(vi.getTimerCount()).toBe(1);

        await expect(result).rejects.toBe(err);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('rejects with an Error "Timeout" when the promise never settles', async () => {
        const result = promiseWithTimeout(new Promise<string>(() => {}), 1000);
        const caught = result.catch((e: unknown) => e);

        // Not yet timed out: the timeout timer is still pending at 999ms.
        await vi.advanceTimersByTimeAsync(999);
        await Promise.resolve();
        expect(vi.getTimerCount()).toBe(1);

        await vi.advanceTimersByTimeAsync(1);
        const error = await caught;

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Timeout");
    });

    test("uses a custom error message when the promise never settles", async () => {
        const result = promiseWithTimeout(
            new Promise<string>(() => {}),
            2000,
            "custom timeout message",
        );
        const caught = result.catch((e: unknown) => e);

        await vi.advanceTimersByTimeAsync(2000);
        const error = await caught;

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("custom timeout message");
    });
});
