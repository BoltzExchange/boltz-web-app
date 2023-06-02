import { setDenomination, setMaximum } from "../../src/signals";
import {
    convertAmount,
    formatAmount,
    getValidationRegex,
    calculateDigits,
    denominations,
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
                setDenomination(denomination);
                expect(convertAmount(amount)).toEqual(converted);
            }
        );
    });

    describe("format amount", () => {
        test.each`
            denomination         | amount           | formatted
            ${denominations.sat} | ${"123123"}      | ${123123}
            ${denominations.sat} | ${"12312300000"} | ${12312300000}
            ${denominations.btc} | ${"100123123"}   | ${1.00123123}
            ${denominations.btc} | ${"123123"}      | ${0.00123123}
            ${denominations.btc} | ${"1"}           | ${0.00000001}
            ${denominations.btc} | ${"1000"}        | ${0.00001}
            ${denominations.btc} | ${"1000"}        | ${0.00001}
        `(
            "format $amount in $denomination",
            ({ denomination, amount, formatted }) => {
                setDenomination(denomination);
                expect(formatAmount(amount)).toEqual(formatted);
            }
        );
    });

    describe("calculate allowed digits", () => {
        test.each`
            denomination         | digits | amount
            ${denominations.sat} | ${4}   | ${1000}
            ${denominations.sat} | ${6}   | ${100000}
            ${denominations.sat} | ${9}   | ${100000000}
            ${denominations.sat} | ${10}  | ${1000000000}
            ${denominations.sat} | ${11}  | ${10000000000}
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
            }
        );
    });

    describe("check paste validation regex", () => {
        beforeAll(() => {
            setMaximum(100000000);
        });
        test.each`
            denomination         | amount           | valid
            ${denominations.sat} | ${"123123"}      | ${true}
            ${denominations.sat} | ${"12312300000"} | ${false}
            ${denominations.sat} | ${"lol"}         | ${false}
            ${denominations.btc} | ${"123123"}      | ${true}
            ${denominations.btc} | ${"0.123123"}    | ${true}
            ${denominations.btc} | ${"0.1231.23"}   | ${false}
            ${denominations.btc} | ${"1.12321"}     | ${true}
            ${denominations.btc} | ${"10.12300011"} | ${false}
        `(
            "validating regex for $amount in $denomination",
            ({ denomination, amount, valid }) => {
                setDenomination(denomination);
                let regex = getValidationRegex();
                expect(regex.test(amount)).toEqual(valid);
            }
        );
    });
});
