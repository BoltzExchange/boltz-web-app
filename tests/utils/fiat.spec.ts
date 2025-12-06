import { BigNumber } from "bignumber.js";
import { describe, expect, test, vi } from "vitest";

import { Currency } from "../../src/consts/Enums";
import {
    convertToFiat,
    getBtcPriceKraken,
    getBtcPriceMempool,
    getBtcPriceYadio,
} from "../../src/utils/fiat";

const btcPrice = 100000;
// Mock fetch to avoid calling real endpoints
global.fetch = vi.fn((url: string) => {
    if (url.includes("yadio")) {
        return Promise.resolve({
            json: () =>
                Promise.resolve({
                    BTC: {
                        USD: btcPrice,
                    },
                }),
        } as Response);
    }
    if (url.includes("kraken")) {
        return Promise.resolve({
            json: () =>
                Promise.resolve({
                    result: {
                        XXBTZUSD: {
                            c: [btcPrice.toString(), "1.5"],
                        },
                    },
                }),
        } as Response);
    }
    if (url.includes("mempool")) {
        return Promise.resolve({
            json: () =>
                Promise.resolve({
                    USD: btcPrice,
                }),
        } as Response);
    }
    return Promise.reject(new Error("Unknown URL"));
}) as typeof fetch;

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
    ])("should fetch BTC price from %s", async (_, getBtcPrice) => {
        const result = await getBtcPrice(Currency.USD);
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
});
