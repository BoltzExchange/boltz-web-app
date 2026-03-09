import { BigNumber } from "bignumber.js";
import { describe, expect, test } from "vitest";

import { Currency } from "../../src/consts/Enums";
import {
    convertToFiat,
    getBtcPriceKraken,
    getBtcPriceMempool,
    getBtcPriceYadio,
    getEthPriceCoinGecko,
    getEthPriceKraken,
    usdCentsToWei,
} from "../../src/utils/fiat";

describe("fiat", () => {
    const checkResult = (result: BigNumber) => {
        expect(result).toBeInstanceOf(BigNumber);
        expect(result.toNumber()).toBeLessThan(10_000_000);
        expect(result.toNumber()).toBeGreaterThan(0);
    };

    test.each([
        ["Mempool", getBtcPriceMempool],
        ["Kraken", getBtcPriceKraken],
        ["Yadio", getBtcPriceYadio],
    ])("should fetch BTC price from $0", async (_, getBtcPrice) => {
        const result = await getBtcPrice(Currency.USD);
        checkResult(result);
    });

    test("should fetch ETH price from Kraken", async () => {
        const result = await getEthPriceKraken(Currency.USD);
        checkResult(result);
    });

    test("should fetch ETH price from CoinGecko", async () => {
        const result = await getEthPriceCoinGecko(Currency.USD);
        checkResult(result);
    });

    test.each([
        [
            "normal conversion",
            BigNumber(100_000_000),
            BigNumber(50_000),
            BigNumber(50_000),
        ],
        ["zero amount", BigNumber(0), BigNumber(50_000), BigNumber(0)],
        ["zero rate", BigNumber(100_000_000), BigNumber(0), BigNumber(0)],
        [
            "fractional sats",
            BigNumber(50_000_000),
            BigNumber(60_000),
            BigNumber(30_000),
        ],
        ["small amount", BigNumber(1_000), BigNumber(50_000), BigNumber(0.5)],
        [
            "high rate",
            BigNumber(100_000_000),
            BigNumber(100_000),
            BigNumber(100_000),
        ],
        ["NaN amount", BigNumber(NaN), BigNumber(50_000), BigNumber(0)],
        ["NaN rate", BigNumber(100_000_000), BigNumber(NaN), BigNumber(0)],
        ["both NaN", BigNumber(NaN), BigNumber(NaN), BigNumber(0)],
    ])("should convert to fiat: %s", (_, amount, rate, expected) => {
        const result = convertToFiat(amount, rate);
        expect(result).toBeInstanceOf(BigNumber);
        expect(result.toNumber()).toBe(expected.toNumber());
    });

    test.each([
        ["one ether", 350_000, BigNumber(3_500), 1_000_000_000_000_000_000n],
        ["fractional ether", 123, BigNumber(2_460), 500_000_000_000_000n],
        ["round down partial wei", 1, BigNumber(3), 3_333_333_333_333_333n],
        ["zero cents", 0, BigNumber(3_500), 0n],
        ["zero price", 100, BigNumber(0), 0n],
        ["NaN cents", Number.NaN, BigNumber(3_500), 0n],
        ["NaN price", 100, BigNumber(NaN), 0n],
    ])(
        "should convert usd cents to wei: %s",
        (_, cents, ethUsdPrice, expected) => {
            expect(usdCentsToWei(cents, ethUsdPrice)).toBe(expected);
        },
    );
});
