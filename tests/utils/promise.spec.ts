import { firstResolved } from "../../src/utils/promise";

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
});
