import { toError } from "../src/errors.ts";

describe("toError", () => {
    test("returns the same Error instance unchanged", () => {
        const err = new Error("original");
        expect(toError(err)).toBe(err);
    });

    test("preserves an Error subclass", () => {
        class CustomError extends Error {}
        const err = new CustomError("custom");
        expect(toError(err)).toBe(err);
        expect(toError(err)).toBeInstanceOf(CustomError);
    });

    test("wraps a string in an Error with that message", () => {
        const result = toError("boom");
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("boom");
    });

    test("wraps a non-Error object using its formatted message", () => {
        const result = toError({ error: "backend failed" });
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("backend failed");
    });
});
