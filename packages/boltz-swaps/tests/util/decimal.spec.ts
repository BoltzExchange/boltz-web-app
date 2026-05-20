import { parseScaledBigInt } from "../../src/util/decimal.ts";

describe("parseScaledBigInt", () => {
    test.each([
        ["0", 9, 0n],
        [0, 9, 0n],
        ["1", 9, 1_000_000_000n],
        [1, 9, 1_000_000_000n],
        ["1.3", 9, 1_300_000_000n],
        [1.3, 9, 1_300_000_000n],
        ["7", 9, 7_000_000_000n],
        [7, 9, 7_000_000_000n],
        ["0.5", 9, 500_000_000n],
        [0.5, 9, 500_000_000n],
        ["0.000000001", 9, 1n],
        [1e-9, 9, 1n],
        [1e-7, 9, 100n],
        ["1.234567890", 9, 1_234_567_890n],
        ["1.2300000000", 9, 1_230_000_000n],
        ["0.000", 3, 0n],
        ["0.000", 2, 0n],
        ["5", 2, 500n],
        [1.23, 4, 12_300n],
        ["10.01", 4, 100_100n],
        ["10.010", 4, 100_100n],
        [
            "12345678901234567890.123456789",
            9,
            12_345_678_901_234_567_890_123_456_789n,
        ],
        [0, 0, 0n],
        ["0", 0, 0n],
        [1, 0, 1n],
        [2, 0, 2n],
        ["207543", 0, 207_543n],
        [207_543, 0, 207_543n],
        [105_000, 0, 105_000n],
        [350_000, 0, 350_000n],
    ] as const)(
        "parseScaledBigInt(%j, %d) === %s",
        (input, decimals, expected) => {
            expect(parseScaledBigInt(input, decimals)).toBe(expected);
        },
    );

    describe("rejects invalid input", () => {
        test.each([
            [-1, 9],
            ["-1", 9],
            ["-0.5", 9],
            [NaN, 9],
            [Infinity, 9],
            ["abc", 9],
            ["", 9],
            [" 1", 9],
            ["1 ", 9],
            ["+1", 9],
            ["01", 9],
            ["00", 9],
            ["00.1", 9],
            [".1", 9],
            ["1.", 9],
            ["1.2.3", 9],
            ["1e3", 9],
            [1e21, 0],
        ] as const)("%j (decimals=%d)", (input, decimals) => {
            expect(() => parseScaledBigInt(input, decimals)).toThrow();
        });
    });

    describe("rejects over-precise input", () => {
        test.each([
            ["1.2345678901", 9],
            [1.5, 0],
            ["1.5", 0],
            ["0.1", 0],
            ["1.231", 2],
            ["0.001", 2],
        ] as const)("%j (decimals=%d)", (input, decimals) => {
            expect(() => parseScaledBigInt(input, decimals)).toThrow();
        });
    });

    describe("rejects invalid decimal scales", () => {
        test.each([
            -1,
            1.5,
            NaN,
            Infinity,
            -Infinity,
            Number.MAX_SAFE_INTEGER + 1,
        ] as const)("%j", (decimals) => {
            expect(() => parseScaledBigInt("1", decimals)).toThrow(
                "invalid decimal scale",
            );
        });
    });
});
