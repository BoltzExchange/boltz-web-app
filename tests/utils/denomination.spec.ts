import { beforeAll, describe, expect, test } from "vitest";

import { setDenomination, setMaximum } from "../../src/signals";
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
                expect(convertAmount(amount, denomination)).toEqual(converted);
            },
        );
    });

    describe("format amount", () => {
        test.each`
            denomination         | amount         | formatted
            ${denominations.sat} | ${123123}      | ${"123123"}
            ${denominations.sat} | ${12312300000} | ${"12312300000"}
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
                setDenomination(denomination);
                expect(formatAmount(amount)).toEqual(formatted);
            },
        );
    });

    describe("calculate allowed digits", () => {
        test.each`
            denomination         | digits | amount
            ${denominations.sat} | ${5}   | ${1000}
            ${denominations.sat} | ${7}   | ${100000}
            ${denominations.sat} | ${10}  | ${100000000}
            ${denominations.sat} | ${11}  | ${1000000000}
            ${denominations.sat} | ${12}  | ${10000000000}
            ${denominations.btc} | ${10}  | ${1000}
            ${denominations.btc} | ${10}  | ${100000}
            ${denominations.btc} | ${10}  | ${10000000}
            ${denominations.btc} | ${10}  | ${100000000}
            ${denominations.btc} | ${11}  | ${1000000000}
            ${denominations.btc} | ${12}  | ${10000000000}
            ${denominations.btc} | ${13}  | ${100000000000}
        `(
            "calculate digits for $amount in $denomination",
            ({ denomination, digits, amount }) => {
                setMaximum(amount);
                setDenomination(denomination);
                expect(calculateDigits()).toEqual(digits);
            },
        );
    });

    describe("check paste validation regex", () => {
        const max = 100000000;

        beforeAll(() => {
            setMaximum(max);
        });

        test.each`
            denomination         | amount                  | valid
            ${denominations.sat} | ${"123123"}             | ${true}
            ${denominations.sat} | ${"12312300000"}        | ${false}
            ${denominations.sat} | ${max}                  | ${true}
            ${denominations.sat} | ${"lol"}                | ${false}
            ${denominations.btc} | ${"lol"}                | ${false}
            ${denominations.btc} | ${"123123"}             | ${true}
            ${denominations.btc} | ${"0.123123"}           | ${true}
            ${denominations.btc} | ${"0.1231.23"}          | ${false}
            ${denominations.btc} | ${"1.12321"}            | ${true}
            ${denominations.btc} | ${"10.12300011"}        | ${false}
            ${denominations.btc} | ${max / 10 ** 8}        | ${true}
            ${denominations.btc} | ${(max / 10 ** 8) * 10} | ${false}
            ${denominations.btc} | ${"0.12312313123131"}   | ${false}
        `(
            "validating regex for $amount in $denomination",
            ({ denomination, amount, valid }) => {
                setDenomination(denomination);
                let regex = getValidationRegex();
                expect(regex.test(amount)).toEqual(valid);
            },
        );
    });
});
