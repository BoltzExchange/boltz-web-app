import { BigNumber } from "bignumber.js";

import {
    BTC,
    LBTC,
    LN,
    RBTC,
    TBTC,
    USDT0,
    WBTC,
} from "../../src/consts/Assets";
import { Denomination } from "../../src/consts/Enums";
import {
    calculateDigits,
    convertAmount,
    formatAmount,
    formatAssetAmountForLog,
    formatDenomination,
    formatNativeAmountForLog,
    formatSwapAmountForLog,
    getDecimals,
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
                    convertAmount(
                        BTC,
                        BigNumber(amount),
                        denomination,
                    ).toNumber(),
                ).toEqual(converted);
            },
        );

        test.each`
            amount          | converted
            ${"0.000001"}   | ${1}
            ${"1.234567"}   | ${1234567}
            ${"123.123456"} | ${123123456}
        `(
            "convert ERC20 $amount in sats denomination",
            ({ amount, converted }) => {
                expect(
                    convertAmount(
                        USDT0,
                        BigNumber(amount),
                        Denomination.Sat,
                    ).toNumber(),
                ).toEqual(converted);
            },
        );

        test("converts WBTC like TBTC in sats denomination", () => {
            expect(
                convertAmount(
                    WBTC,
                    BigNumber("12345678"),
                    Denomination.Sat,
                ).toNumber(),
            ).toEqual(12345678);
        });

        test("converts WBTC like TBTC in BTC denomination", () => {
            expect(
                convertAmount(
                    WBTC,
                    BigNumber("0.12345678"),
                    Denomination.Btc,
                ).toNumber(),
            ).toEqual(12345678);
        });
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
            ${Denomination.Sat} | ${0.12}        | ${","}    | ${"0,12"}
            ${Denomination.Sat} | ${0.24}        | ${","}    | ${"0,24"}
        `(
            "format $amount in $denomination with `$separator` separator",
            ({ denomination, amount, formatted, separator }) => {
                expect(
                    formatAmount(
                        BigNumber(amount),
                        denomination,
                        separator,
                        BTC,
                    ),
                ).toEqual(formatted);
            },
        );

        test("formats WBTC sats like TBTC sats", () => {
            expect(
                formatAmount(BigNumber(123123), Denomination.Sat, ".", WBTC),
            ).toEqual("123 123");
        });
    });

    test("treats routed WBTC as sat-denominated for display inputs", () => {
        expect(getDecimals(WBTC)).toEqual({
            isErc20: false,
            decimals: 8,
        });
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
            const regex = getValidationRegex(max);
            expect(regex.test(amount)).toEqual(valid);
        });
    });

    test.each`
        denomination        | input    | expected
        ${Denomination.Sat} | ${BTC}   | ${"sats"}
        ${Denomination.Sat} | ${LBTC}  | ${"sats"}
        ${Denomination.Btc} | ${BTC}   | ${BTC}
        ${Denomination.Btc} | ${LBTC}  | ${"LBTC"}
        ${Denomination.Sat} | ${TBTC}  | ${"sats"}
        ${Denomination.Btc} | ${TBTC}  | ${"TBTC"}
        ${Denomination.Sat} | ${USDT0} | ${"USDT"}
        ${Denomination.Btc} | ${USDT0} | ${"USDT"}
        ${Denomination.Sat} | ${WBTC}  | ${"sats"}
        ${Denomination.Btc} | ${WBTC}  | ${"WBTC"}
    `("should format denomination", ({ denomination, input, expected }) => {
        expect(formatDenomination(denomination, input)).toEqual(expected);
    });

    describe("format asset amount for logs", () => {
        test.each`
            amount              | asset    | expected
            ${"2572605"}        | ${USDT0} | ${"2.572605 USDT"}
            ${2572605n}         | ${USDT0} | ${"2.572605 USDT"}
            ${"33480000000000"} | ${TBTC}  | ${"0.00003348 TBTC"}
            ${33480000000000n}  | ${TBTC}  | ${"0.00003348 TBTC"}
            ${10000000000000n}  | ${RBTC}  | ${"0.00001 RBTC"}
            ${"1016"}           | ${BTC}   | ${"1016 sats"}
            ${1016n}            | ${LBTC}  | ${"1016 sats"}
            ${1016n}            | ${LN}    | ${"1016 sats"}
        `(
            "formats $amount of $asset as $expected",
            ({ amount, asset, expected }) => {
                expect(formatAssetAmountForLog(amount, asset)).toEqual(
                    expected,
                );
            },
        );

        test("falls back to the raw amount for unknown assets", () => {
            expect(formatAssetAmountForLog(150n, "UNKNOWN")).toEqual(
                "150 UNKNOWN",
            );
        });

        test("formats native amounts for logs", () => {
            expect(formatNativeAmountForLog(10000000000000n, RBTC)).toEqual(
                "0.00001 RBTC",
            );
        });

        // Swap denomination: sats for BTC-pegged assets (incl. RBTC, unlike the
        // on-chain wei above), token units for ERC20.
        test.each`
            amount            | asset    | expected
            ${2572605n}       | ${USDT0} | ${"2.572605 USDT"}
            ${3348n}          | ${TBTC}  | ${"3348 sats"}
            ${1016n}          | ${RBTC}  | ${"1016 sats"}
            ${BigNumber(101)} | ${BTC}   | ${"101 sats"}
        `(
            "formats internal $amount of $asset as $expected",
            ({ amount, asset, expected }) => {
                expect(formatSwapAmountForLog(amount, asset)).toEqual(expected);
            },
        );
    });
});
