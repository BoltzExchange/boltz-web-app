import {
    calculateAmountOutMin,
    calculateAmountWithSlippage,
} from "../src/helper.ts";

// Golden vectors pinned from the host implementation these were moved out of
// (src/utils/calculate.ts). `slippage` is a fraction (0.01 == 1%).
describe("calculateAmountWithSlippage", () => {
    test.each`
        amount   | slippage  | expected
        ${1000n} | ${0}      | ${1000n}
        ${1000n} | ${0.01}   | ${1010n}
        ${1000n} | ${0.0005} | ${1001n}
        ${1000n} | ${0.0004} | ${1001n}
        ${1n}    | ${0.001}  | ${2n}
        ${1001n} | ${0.001}  | ${1003n}
    `(
        "should apply full slippage and ceil result for $amount at $slippage",
        ({ amount, slippage, expected }) => {
            expect(calculateAmountWithSlippage(amount, slippage)).toEqual(
                expected,
            );
        },
    );

    test("should handle large bigint values without number conversion", () => {
        expect(
            calculateAmountWithSlippage(123456789012345678901234567890n, 0.01),
        ).toEqual(124691356902469135690246913569n);
    });

    test("should preserve 0.75% slippage precision", () => {
        expect(calculateAmountWithSlippage(15030000000000n, 0.0075)).toEqual(
            15142725000000n,
        );
    });

    test.each([NaN, Infinity, -Infinity])(
        "throws TypeError for non-finite slippage %p",
        (slippage) => {
            expect(() => calculateAmountWithSlippage(1000n, slippage)).toThrow(
                TypeError,
            );
        },
    );

    test.each([-0.0001, -0.5, 1.0001, 2])(
        "throws RangeError for out-of-range slippage %p",
        (slippage) => {
            expect(() => calculateAmountWithSlippage(1000n, slippage)).toThrow(
                RangeError,
            );
        },
    );
});

describe("calculateAmountOutMin", () => {
    test.each`
        amountOut | slippage  | expected
        ${1000n}  | ${0}      | ${1000n}
        ${1000n}  | ${0.01}   | ${990n}
        ${1000n}  | ${0.0005} | ${999n}
        ${1000n}  | ${0.0004} | ${999n}
        ${1n}     | ${0.001}  | ${0n}
        ${1001n}  | ${0.001}  | ${999n}
    `(
        "should subtract full slippage and floor result for $amountOut at $slippage",
        ({ amountOut, slippage, expected }) => {
            expect(calculateAmountOutMin(amountOut, slippage)).toEqual(
                expected,
            );
        },
    );

    test("should handle large bigint values without number conversion", () => {
        expect(
            calculateAmountOutMin(123456789012345678901234567890n, 0.01),
        ).toEqual(122222221122222222112222222211n);
    });

    test("inherits the slippage validation from calculateAmountWithSlippage", () => {
        expect(() => calculateAmountOutMin(1000n, -0.5)).toThrow(RangeError);
        expect(() => calculateAmountOutMin(1000n, NaN)).toThrow(TypeError);
    });
});
