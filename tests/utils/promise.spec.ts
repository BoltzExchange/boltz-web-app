import log from "loglevel";

import {
    firstResolved,
    promiseWithTimeout,
    retryWithBackoff,
} from "../../src/utils/promise";

const logWarn = vi.spyOn(log, "warn").mockImplementation(() => {});

describe("promise", () => {
    describe("firstResolved", () => {
        it("should resolve with the first resolved promise", async () => {
            const promises = [
                new Promise((resolve) =>
                    setTimeout(() => resolve("first"), 100),
                ),
                new Promise((resolve) =>
                    setTimeout(() => resolve("second"), 50),
                ),
                new Promise((resolve) =>
                    setTimeout(() => resolve("third"), 150),
                ),
            ];

            await expect(firstResolved(promises)).resolves.toBe("second");
        });

        it("should resolve even if some promises reject", async () => {
            const promises = [
                Promise.reject(new Error("first rejection")),
                new Promise((resolve) =>
                    setTimeout(() => resolve("success"), 50),
                ),
                Promise.reject(new Error("second rejection")),
            ];

            await expect(firstResolved(promises)).resolves.toBe("success");
        });

        it("should reject if all promises reject", async () => {
            const promises = [
                Promise.reject(new Error("error 1")),
                Promise.reject(new Error("error 2")),
                Promise.reject(new Error("error 3")),
            ];

            await expect(firstResolved(promises)).rejects.toThrow();
        });

        it("should throw an error if no promises are provided", () => {
            expect(() => firstResolved([])).toThrow("no promises provided");
        });
    });

    describe("promiseWithTimeout", () => {
        it("should resolve with the promise result if it resolves before timeout", async () => {
            const promise = Promise.resolve("success");
            await expect(promiseWithTimeout(promise, 100)).resolves.toBe(
                "success",
            );
        });

        it("should reject with timeout error if promise takes too long", async () => {
            const slowPromise = new Promise((resolve) =>
                setTimeout(() => resolve("too late"), 200),
            );

            await expect(promiseWithTimeout(slowPromise, 100)).rejects.toThrow(
                "Timeout",
            );
        });

        it("should use custom error message when provided", async () => {
            const slowPromise = new Promise((resolve) =>
                setTimeout(() => resolve("too late"), 200),
            );

            await expect(
                promiseWithTimeout(slowPromise, 100, "custom timeout message"),
            ).rejects.toThrow("custom timeout message");
        });

        it("should reject with the promise error if promise rejects before timeout", async () => {
            const failingPromise = Promise.reject(new Error("promise failure"));

            await expect(
                promiseWithTimeout(failingPromise, 100),
            ).rejects.toThrow("promise failure");
        });
    });

    describe("retryWithBackoff", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            logWarn.mockClear();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should return on first success without retrying", async () => {
            const fn = vi.fn().mockResolvedValue("ok");

            const result = await retryWithBackoff(fn, 3, 1000);

            expect(result).toBe("ok");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should retry on failure and resolve on subsequent success", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("fail 1"))
                .mockRejectedValueOnce(new Error("fail 2"))
                .mockResolvedValue("ok");

            const promise = retryWithBackoff(fn, 3, 100);

            await vi.advanceTimersByTimeAsync(100);
            await vi.advanceTimersByTimeAsync(200);

            await expect(promise).resolves.toBe("ok");
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it("should throw on final attempt after exhausting retries", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("always fails"));

            const promise = retryWithBackoff(fn, 2, 100);
            // Attach handler immediately to avoid unhandled rejection
            const caught = promise.catch((e: Error) => e);

            await vi.runAllTimersAsync();

            const err = (await caught) as Error;
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe("always fails");
            // 2 retries + 1 final = 3 total
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it("should apply exponential backoff delays", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("fail 1"))
                .mockRejectedValueOnce(new Error("fail 2"))
                .mockRejectedValueOnce(new Error("fail 3"))
                .mockResolvedValue("ok");

            const promise = retryWithBackoff(fn, 3, 1000);

            expect(fn).toHaveBeenCalledTimes(1);

            // 1st backoff: 1000 * 2^0 = 1000ms
            await vi.advanceTimersByTimeAsync(999);
            expect(fn).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(1);
            expect(fn).toHaveBeenCalledTimes(2);

            // 2nd backoff: 1000 * 2^1 = 2000ms
            await vi.advanceTimersByTimeAsync(1999);
            expect(fn).toHaveBeenCalledTimes(2);
            await vi.advanceTimersByTimeAsync(1);
            expect(fn).toHaveBeenCalledTimes(3);

            // 3rd backoff: 1000 * 2^2 = 4000ms
            await vi.advanceTimersByTimeAsync(3999);
            expect(fn).toHaveBeenCalledTimes(3);
            await vi.advanceTimersByTimeAsync(1);
            expect(fn).toHaveBeenCalledTimes(4);

            await expect(promise).resolves.toBe("ok");
        });

        it("should log warnings on each retry", async () => {
            const error1 = new Error("fail 1");
            const error2 = new Error("fail 2");
            const fn = vi
                .fn()
                .mockRejectedValueOnce(error1)
                .mockRejectedValueOnce(error2)
                .mockResolvedValue("ok");

            const promise = retryWithBackoff(fn, 3, 500);

            await vi.advanceTimersByTimeAsync(500);
            await vi.advanceTimersByTimeAsync(1000);

            await expect(promise).resolves.toBe("ok");
            expect(logWarn).toHaveBeenCalledTimes(2);
            expect(logWarn).toHaveBeenNthCalledWith(
                1,
                "Attempt 1 failed, retrying in 500ms",
                error1,
            );
            expect(logWarn).toHaveBeenNthCalledWith(
                2,
                "Attempt 2 failed, retrying in 1000ms",
                error2,
            );
        });

        it("should not log when fn succeeds on first attempt", async () => {
            const fn = vi.fn().mockResolvedValue("ok");

            await retryWithBackoff(fn, 3, 1000);

            expect(logWarn).not.toHaveBeenCalled();
        });

        it("should work with maxRetries of 0 (single attempt, no retries)", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("fail"));

            await expect(retryWithBackoff(fn, 0, 1000)).rejects.toThrow(
                "fail",
            );
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should rethrow immediately when isRetryable returns false", async () => {
            const nonRetryable = new Error("user rejected action");
            const fn = vi.fn().mockRejectedValue(nonRetryable);

            await expect(
                retryWithBackoff(fn, 3, 1000, () => false),
            ).rejects.toThrow("user rejected action");
            expect(fn).toHaveBeenCalledTimes(1);
            expect(logWarn).not.toHaveBeenCalled();
        });

        it("should retry when isRetryable returns true", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("transient"))
                .mockResolvedValue("ok");

            const promise = retryWithBackoff(fn, 3, 100, () => true);

            await vi.advanceTimersByTimeAsync(100);

            await expect(promise).resolves.toBe("ok");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should selectively retry based on error type", async () => {
            const retryable = new Error("LZ_InsufficientFee");
            const nonRetryable = new Error("user rejected action");
            const fn = vi
                .fn()
                .mockRejectedValueOnce(retryable)
                .mockRejectedValueOnce(nonRetryable);
            const isRetryable = (e: unknown) =>
                e instanceof Error && e.message.includes("LZ_InsufficientFee");

            const promise = retryWithBackoff(fn, 3, 100, isRetryable);
            const caught = promise.catch((e: Error) => e);

            await vi.advanceTimersByTimeAsync(100);

            const err = (await caught) as Error;
            expect(err.message).toBe("user rejected action");
            expect(fn).toHaveBeenCalledTimes(2);
            expect(logWarn).toHaveBeenCalledTimes(1);
        });
    });
});
