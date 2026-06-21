import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
    constructRequestOptions,
    defaultTimeoutDuration,
} from "../src/helper.ts";

describe("constructRequestOptions", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("default timeout aborts opts.signal with the exact reason shape", () => {
        const { opts } = constructRequestOptions();

        const signal = opts.signal as AbortSignal;
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);

        vi.advanceTimersByTime(defaultTimeoutDuration);

        expect(signal.aborted).toBe(true);
        expect(signal.reason).toEqual({ reason: "Request timed out" });
    });

    test("clearTimeout before advancing keeps the signal un-aborted", () => {
        const { opts, requestTimeout } = constructRequestOptions();

        const signal = opts.signal as AbortSignal;
        expect(signal.aborted).toBe(false);

        clearTimeout(requestTimeout);
        vi.advanceTimersByTime(defaultTimeoutDuration);

        expect(signal.aborted).toBe(false);
        expect(signal.reason).toBeUndefined();
    });

    test("caller-supplied signal overrides the controller signal and merges other fields", () => {
        const externalController = new AbortController();
        const externalSignal = externalController.signal;

        const { opts } = constructRequestOptions({
            method: "POST",
            headers: { Accept: "application/json" },
            signal: externalSignal,
        });

        expect(opts.signal).toBe(externalSignal);
        expect(opts.method).toBe("POST");
        expect(opts.headers).toEqual({ Accept: "application/json" });

        vi.advanceTimersByTime(defaultTimeoutDuration);
        expect(externalSignal.aborted).toBe(false);
        expect((opts.signal as AbortSignal).aborted).toBe(false);
    });

    test("custom timeout argument governs the abort timing", () => {
        const { opts } = constructRequestOptions({}, 500);

        const signal = opts.signal as AbortSignal;

        vi.advanceTimersByTime(499);
        expect(signal.aborted).toBe(false);

        vi.advanceTimersByTime(1);
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toEqual({ reason: "Request timed out" });
    });
});

describe("calculateAmountWithSlippage edge vectors", () => {
    test.each`
        amount    | slippage   | expected
        ${1000n}  | ${0.00005} | ${1001n}
        ${1000n}  | ${0.00004} | ${1000n}
        ${0n}     | ${0.01}    | ${0n}
        ${0n}     | ${0}       | ${0n}
        ${10000n} | ${0.01}    | ${10100n}
    `(
        "should resolve $amount at $slippage to $expected",
        ({ amount, slippage, expected }) => {
            expect(calculateAmountWithSlippage(amount, slippage)).toEqual(
                expected,
            );
        },
    );

    test("rounds the bps half-boundary up (0.00005 -> Math.round(0.5) -> 1 bps)", () => {
        expect(calculateAmountWithSlippage(1000n, 0.00005)).toEqual(1001n);
        expect(calculateAmountWithSlippage(1000n, 0.00004)).toEqual(1000n);
    });

    test("zero amount is never pushed up by the ceil offset", () => {
        expect(calculateAmountWithSlippage(0n, 0.01)).toEqual(0n);
        expect(calculateAmountWithSlippage(0n, 0)).toEqual(0n);
    });

    test("exact-divisibility path adds no ceil bump", () => {
        expect(calculateAmountWithSlippage(10000n, 0.01)).toEqual(10100n);
    });
});

describe("calculateAmountOutMin edge vectors", () => {
    test.each`
        amountOut | slippage | expected
        ${0n}     | ${0.01}  | ${0n}
        ${1n}     | ${1.0}   | ${0n}
    `(
        "should resolve $amountOut at $slippage to $expected",
        ({ amountOut, slippage, expected }) => {
            expect(calculateAmountOutMin(amountOut, slippage)).toEqual(
                expected,
            );
        },
    );

    test("zero amountOut stays at zero (slippageAmount = 0)", () => {
        expect(calculateAmountOutMin(0n, 0.01)).toEqual(0n);
    });

    test("floor never goes negative at 100% slippage on amountOut = 1", () => {
        expect(calculateAmountOutMin(1n, 1.0)).toEqual(0n);
    });

    test("ceil-asymmetry coupling: 1-unit growth ceil maps to a 1-unit floor reduction", () => {
        expect(calculateAmountWithSlippage(1n, 0.001)).toEqual(2n);
        expect(calculateAmountOutMin(1n, 0.001)).toEqual(0n);
    });
});
