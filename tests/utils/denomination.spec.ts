import { BigNumber } from "bignumber.js";

import {
    calculateDigits,
    convertAmount,
    denominations,
    formatAmount,
    getValidationRegex,
} from "../../src/utils/denomination";

describe("denomination utils", () => {
    describe("convert amount", () => {
        test.each`
            denomination         | amount           | converted
            ${denominations.sat} | ${"123123"}      | ${123123}
            ${denominations.sat} | ${"12312300000"} | ${12312300000}
            ${denominations.btc} | ${"0.00123123"}  | ${123123}
            ${denominations.btc} | ${"0.999999"}    | ${99999900}
            ${denominations.btc} | ${"1.123123"}    | ${112312300}
        `(
            "convert $amount in $denomination",
            ({ denomination, amount, converted }) => {
                expect(
                    convertAmount(BigNumber(amount), denomination).toNumber(),
                ).toEqual(converted);
            },
        );
    });

    describe("format amount", () => {
        test.each`
            denomination         | amount         | formatted
            ${denominations.sat} | ${123123}      | ${"123 123"}
            ${denominations.sat} | ${12312300000} | ${"12 312 300 000"}
            ${denominations.btc} | ${100123123}   | ${"1.00123123"}
            ${denominations.btc} | ${123123}      | ${"0.00123123"}
            ${denominations.btc} | ${1}           | ${"0.00000001"}
            ${denominations.btc} | ${10}          | ${"0.0000001"}
            ${denominations.btc} | ${100}         | ${"0.000001"}
            ${denominations.btc} | ${1000}        | ${"0.00001"}
            ${denominations.btc} | ${10000}       | ${"0.0001"}
        `(
            "format $amount in $denomination",
            ({ denomination, amount, formatted }) => {
                expect(formatAmount(BigNumber(amount), denomination)).toEqual(
                    formatted,
                );
            },
        );
    });

    describe("calculate allowed digits", () => {
        test.each`
            denomination         | digits | amount
            ${denominations.sat} | ${5}   | ${1_000}
            ${denominations.sat} | ${7}   | ${100_000}
            ${denominations.sat} | ${11}  | ${100_000_000}
            ${denominations.sat} | ${13}  | ${1_000_000_000}
            ${denominations.sat} | ${14}  | ${10_000_000_000}
            ${denominations.btc} | ${10}  | ${1_000}
            ${denominations.btc} | ${10}  | ${100_000}
            ${denominations.btc} | ${10}  | ${10_000_000}
            ${denominations.btc} | ${10}  | ${100_000_000}
            ${denominations.btc} | ${11}  | ${1_000_000_000}
            ${denominations.btc} | ${12}  | ${10_000_000_000}
            ${denominations.btc} | ${13}  | ${100_000_000_000}
        `(
            "calculate digits for $amount in $denomination",
            ({ denomination, digits, amount }) => {
                expect(calculateDigits(amount, denomination)).toEqual(digits);
            },
        );
    });

    describe("check paste validation regex", () => {
        const max = 40_000_000;

        test.each`
            amount           | valid
            ${"123123"}      | ${true}
            ${max}           | ${true}
            ${max * 10}      | ${false}
            ${"lol"}         | ${false}
            ${"0.12312333"}  | ${true}
            ${"0.1231.23"}   | ${false}
            ${"1.12321"}     | ${false}
            ${"10.12300011"} | ${false}
            ${"0.123123131"} | ${false}
            ${"0,123"}       | ${false}
        `("validating regex for $amount", ({ amount, valid }) => {
            let regex = getValidationRegex(max);
            expect(regex.test(amount)).toEqual(valid);
        });
    });
});
