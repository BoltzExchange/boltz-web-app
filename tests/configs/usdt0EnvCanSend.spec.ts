import { envCanSend } from "../../src/configs/usdt0";

describe("envCanSend", () => {
    test("returns fallback when env value is undefined", () => {
        expect(envCanSend(undefined, true)).toBe(true);
        expect(envCanSend(undefined, false)).toBe(false);
    });

    test("returns fallback for empty or whitespace-only values", () => {
        expect(envCanSend("", true)).toBe(true);
        expect(envCanSend("   ", false)).toBe(false);
        expect(envCanSend("\t\n", true)).toBe(true);
    });

    test("parses true case-insensitively and ignoring surrounding whitespace", () => {
        expect(envCanSend("true", false)).toBe(true);
        expect(envCanSend("TRUE", false)).toBe(true);
        expect(envCanSend("True", false)).toBe(true);
        expect(envCanSend("  true  ", false)).toBe(true);
    });

    test("parses false case-insensitively and ignoring surrounding whitespace", () => {
        expect(envCanSend("false", true)).toBe(false);
        expect(envCanSend("FALSE", true)).toBe(false);
        expect(envCanSend("False", true)).toBe(false);
        expect(envCanSend("  false  ", true)).toBe(false);
    });

    test("throws on values that are not true or false", () => {
        expect(() => envCanSend("yes", true)).toThrow(
            /Invalid USDT0 canSend flag/,
        );
        expect(() => envCanSend("1", true)).toThrow(/got "1"/);
        expect(() => envCanSend("0", false)).toThrow(/got "0"/);
        expect(() => envCanSend("nope", true)).toThrow(/got "nope"/);
    });
});
