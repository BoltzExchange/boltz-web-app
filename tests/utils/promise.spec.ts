import { firstResolved, promiseWithTimeout } from "../../src/utils/promise";

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
});
