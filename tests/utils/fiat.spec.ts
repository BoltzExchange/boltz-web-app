import { BigNumber } from "bignumber.js";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Currency } from "../../src/consts/Enums";
import {
    convertToFiat,
    getBtcPriceKraken,
    getBtcPriceMempool,
    getBtcPriceYadio,
    getEthPriceCoinGecko,
    getEthPriceKraken,
    getGasTokenPriceCoinGecko,
    getGasTokenPriceFailover,
    hasGasTokenPriceLookup,
    usdCentsToWei,
} from "../../src/utils/fiat";

describe("fiat", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const checkResult = (result: BigNumber) => {
        expect(result).toBeInstanceOf(BigNumber);
        expect(result.toNumber()).toBeLessThan(10_000_000);
        expect(result.toNumber()).toBeGreaterThan(0);
    };

    test.each([
        ["Mempool", getBtcPriceMempool, { USD: 102_345 }],
        [
            "Kraken",
            getBtcPriceKraken,
            { result: { XXBTZUSD: { c: ["102345.6", "1"] } } },
        ],
        ["Yadio", getBtcPriceYadio, { BTC: { USD: 102_345 } }],
    ])("should fetch BTC price from $0", async (_, getBtcPrice, response) => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue(response),
        } as unknown as Response);

        const result = await getBtcPrice(Currency.USD);
        checkResult(result);
    });

    test("should fetch ETH price from Kraken", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                result: { XETHZUSD: { c: ["3456.78", "1"] } },
            }),
        } as unknown as Response);

        const result = await getEthPriceKraken(Currency.USD);
        checkResult(result);
    });

    test("should fetch ETH price from CoinGecko", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                ethereum: { usd: 3456.78 },
            }),
        } as unknown as Response);

        const result = await getEthPriceCoinGecko(Currency.USD);
        checkResult(result);
    });

    test("should fetch POL price from CoinGecko", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                "polygon-ecosystem-token": { usd: 0.25 },
            }),
        } as unknown as Response);

        const result = await getGasTokenPriceCoinGecko("POL", Currency.USD);
        checkResult(result);
    });

    test("should fetch HBAR price from CoinGecko", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                "hedera-hashgraph": { usd: 0.098585 },
            }),
        } as unknown as Response);

        const result = await getGasTokenPriceCoinGecko("HBAR", Currency.USD);
        checkResult(result);
    });

    test("should fail over gas token pricing with the configured lookup", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                usdt0: { usd: 1 },
            }),
        } as unknown as Response);

        const result = await getGasTokenPriceFailover("USDT0", Currency.USD);
        checkResult(result);
        expect(result.toNumber()).toBe(1);
    });

    test("should price RBTC gas tokens with the BTC failover providers", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                USD: 102_345,
            }),
        } as unknown as Response);

        const result = await getGasTokenPriceFailover("RBTC", Currency.USD);
        checkResult(result);
        expect(result.toNumber()).toBe(102_345);
    });

    test("should report whether a gas token has a USD price lookup", () => {
        expect(hasGasTokenPriceLookup("POL")).toBe(true);
        expect(hasGasTokenPriceLookup("RBTC")).toBe(true);
        expect(hasGasTokenPriceLookup("SOL")).toBe(true);
        expect(hasGasTokenPriceLookup("BTCN")).toBe(false);
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
