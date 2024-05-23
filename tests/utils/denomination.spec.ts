import { BigNumber } from "bignumber.js";

import { Denomination } from "../../src/consts/Enums";
import {
    calculateDigits,
    convertAmount,
    formatAmount,
    getValidationRegex,
} from "../../src/utils/denomination";

describe("denomination utils", () => {
    describe("convert amount", () => {
        test.each`
            denomination        | amount           | converted
            ${Denomination.Sat} | ${"123123"}      | ${123123}
            ${Denomination.Sat} | ${"12312300000"} | ${12312300000}
            ${Denomination.Btc} | ${"0.00123123"}  | ${123123}
            ${Denomination.Btc} | ${"0.999999"}    | ${99999900}
            ${Denomination.Btc} | ${"1.123123"}    | ${112312300}
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
            denomination        | amount         | separator | formatted
            ${Denomination.Sat} | ${123123}      | ${"."}    | ${"123 123"}
            ${Denomination.Sat} | ${12312300000} | ${"."}    | ${"12 312 300 000"}
            ${Denomination.Btc} | ${100123123}   | ${"."}    | ${"1.00123123"}
            ${Denomination.Btc} | ${123123}      | ${"."}    | ${"0.00123123"}
            ${Denomination.Btc} | ${1}           | ${"."}    | ${"0.00000001"}
            ${Denomination.Btc} | ${10}          | ${"."}    | ${"0.0000001"}
            ${Denomination.Btc} | ${14}          | ${"."}    | ${"0.00000014"}
            ${Denomination.Btc} | ${100}         | ${"."}    | ${"0.000001"}
            ${Denomination.Btc} | ${1000}        | ${"."}    | ${"0.00001"}
            ${Denomination.Btc} | ${10000}       | ${"."}    | ${"0.0001"}
            ${Denomination.Btc} | ${10000}       | ${","}    | ${"0,0001"}
        `(
            "format $amount in $denomination with `$separator` separator",
            ({ denomination, amount, formatted, separator }) => {
                expect(
                    formatAmount(BigNumber(amount), denomination, separator),
                ).toEqual(formatted);
            },
        );
    });

    describe("calculate allowed digits", () => {
        test.each`
            denomination        | digits | amount
            ${Denomination.Sat} | ${5}   | ${1_000}
            ${Denomination.Sat} | ${7}   | ${100_000}
            ${Denomination.Sat} | ${11}  | ${100_000_000}
            ${Denomination.Sat} | ${13}  | ${1_000_000_000}
            ${Denomination.Sat} | ${14}  | ${10_000_000_000}
            ${Denomination.Btc} | ${10}  | ${1_000}
            ${Denomination.Btc} | ${10}  | ${100_000}
            ${Denomination.Btc} | ${10}  | ${10_000_000}
            ${Denomination.Btc} | ${10}  | ${100_000_000}
            ${Denomination.Btc} | ${11}  | ${1_000_000_000}
            ${Denomination.Btc} | ${12}  | ${10_000_000_000}
            ${Denomination.Btc} | ${13}  | ${100_000_000_000}
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
            ${"0,123"}       | ${true}
        `("validating regex for $amount", ({ amount, valid }) => {
            let regex = getValidationRegex(max);
            expect(regex.test(amount)).toEqual(valid);
        });
    });
});
