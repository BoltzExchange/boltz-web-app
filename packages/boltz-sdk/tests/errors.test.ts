import { formatError } from "../src/public/errors";

describe("formatError", () => {
    test("returns string input as-is", () => {
        expect(formatError("something went wrong")).toBe("something went wrong");
    });

    test("returns empty string as-is", () => {
        expect(formatError("")).toBe("");
    });

    test("extracts error.message from nested object", () => {
        expect(formatError({ error: { message: "nested msg" } })).toBe(
            "nested msg",
        );
    });

    test("extracts top-level message property", () => {
        expect(formatError({ message: "top level" })).toBe("top level");
    });

    test("extracts top-level error string", () => {
        expect(formatError({ error: "error string" })).toBe("error string");
    });

    test("extracts data string", () => {
        expect(formatError({ data: "some data" })).toBe("some data");
    });

    test("prefers error.message over message", () => {
        expect(
            formatError({
                error: { message: "inner" },
                message: "outer",
            }),
        ).toBe("inner");
    });

    test("prefers message over error string", () => {
        expect(
            formatError({
                message: "msg",
                error: "err string",
            }),
        ).toBe("msg");
    });

    test("prefers error string over data", () => {
        expect(
            formatError({
                error: "err",
                data: "dat",
            }),
        ).toBe("err");
    });

    test("uses toString() for objects with custom toString", () => {
        const obj = {
            toString() {
                return "custom string";
            },
        };
        expect(formatError(obj)).toBe("custom string");
    });

    test("falls back to JSON.stringify for plain objects", () => {
        expect(formatError({ foo: "bar" })).toBe('{"foo":"bar"}');
    });

    test("handles Error instances", () => {
        expect(formatError(new Error("standard error"))).toBe("standard error");
    });

    test("handles null", () => {
        expect(formatError(null)).toBe("null");
    });

    test("handles undefined", () => {
        expect(formatError(undefined)).toBe(undefined);
    });

    test("handles number", () => {
        expect(formatError(42)).toBe("42");
    });

    test("handles boolean", () => {
        expect(formatError(true)).toBe("true");
    });

    test("handles object with non-string message (skips it)", () => {
        expect(formatError({ message: 123, data: "fallback" })).toBe(
            "fallback",
        );
    });

    test("handles deeply nested error without message", () => {
        expect(formatError({ error: { code: 500 } })).toBe(
            '{"error":{"code":500}}',
        );
    });
});

