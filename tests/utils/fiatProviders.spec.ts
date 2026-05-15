// @vitest-environment node
import type { BigNumber } from "bignumber.js";
import { type TestContext, beforeEach, describe, expect, test } from "vitest";

import { Currency } from "../../src/consts/Enums";
import {
    getBtcPriceFailover,
    getBtcPriceKraken,
    getBtcPriceMempool,
    getBtcPriceYadio,
    getEthPriceCoinGecko,
    getEthPriceFailover,
    getEthPriceKraken,
    getGasTokenPriceCoinGecko,
    getGasTokenPriceFailover,
    getGasTokenPriceKraken,
} from "../../src/utils/fiat";

const testTimeout = 15_000;

// CoinGecko's free tier is aggressively rate-limited (~5–15 req/min) and
// occasionally returns a 200 with an error body instead of a clean 429.
// Pace consecutive requests, let vitest retry transient throttling, and
// skip cleanly when the IP is being fully throttled — that's an
// environment-availability issue, not an upstream API regression.
const coinGeckoCooldown = 3_000;
const coinGeckoRetry = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isCoinGeckoThrottle = (message: string) =>
    /missing CoinGecko price/i.test(message) ||
    /all attempts of getting \w+ price failed/i.test(message);

const skipIfCoinGeckoThrottled = (ctx: TestContext, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (isCoinGeckoThrottle(message)) {
        ctx.skip(`CoinGecko rate-limited: ${message}`);
    }
    throw error;
};

const expectInRange = (
    value: BigNumber,
    min: number,
    max: number,
    label: string,
) => {
    expect(value.isFinite(), `${label} should be finite`).toBe(true);
    expect(value.toNumber(), `${label} should be > ${min}`).toBeGreaterThan(
        min,
    );
    expect(value.toNumber(), `${label} should be < ${max}`).toBeLessThan(max);
};

describe("fiat providers (integration)", () => {
    describe("BTC", () => {
        const btcUsdMin = 1_000;
        const btcUsdMax = 1_000_000;

        test(
            "Mempool returns a sane BTC/USD spot price",
            async () => {
                const price = await getBtcPriceMempool(Currency.USD);
                expectInRange(price, btcUsdMin, btcUsdMax, "BTC/USD (Mempool)");
            },
            testTimeout,
        );

        test(
            "Kraken returns a sane BTC/USD spot price",
            async () => {
                const price = await getBtcPriceKraken(Currency.USD);
                expectInRange(price, btcUsdMin, btcUsdMax, "BTC/USD (Kraken)");
            },
            testTimeout,
        );

        test(
            "Yadio returns a sane BTC/USD spot price",
            async () => {
                const price = await getBtcPriceYadio(Currency.USD);
                expectInRange(price, btcUsdMin, btcUsdMax, "BTC/USD (Yadio)");
            },
            testTimeout,
        );

        test(
            "Mempool returns a sane BTC/EUR spot price",
            async () => {
                const price = await getBtcPriceMempool(Currency.EUR);
                expectInRange(price, btcUsdMin, btcUsdMax, "BTC/EUR (Mempool)");
            },
            testTimeout,
        );

        test(
            "Kraken returns a sane BTC/EUR spot price",
            async () => {
                const price = await getBtcPriceKraken(Currency.EUR);
                expectInRange(price, btcUsdMin, btcUsdMax, "BTC/EUR (Kraken)");
            },
            testTimeout,
        );

        test(
            "Yadio returns a sane BTC/EUR spot price",
            async () => {
                const price = await getBtcPriceYadio(Currency.EUR);
                expectInRange(price, btcUsdMin, btcUsdMax, "BTC/EUR (Yadio)");
            },
            testTimeout,
        );

        test(
            "BTC failover returns a sane price in USD",
            async () => {
                const price = await getBtcPriceFailover(Currency.USD);
                expectInRange(
                    price,
                    btcUsdMin,
                    btcUsdMax,
                    "BTC/USD (failover)",
                );
            },
            testTimeout,
        );

        test(
            "BTC failover returns a sane price in EUR",
            async () => {
                const price = await getBtcPriceFailover(Currency.EUR);
                expectInRange(
                    price,
                    btcUsdMin,
                    btcUsdMax,
                    "BTC/EUR (failover)",
                );
            },
            testTimeout,
        );
    });

    describe("ETH (Kraken)", () => {
        const ethUsdMin = 100;
        const ethUsdMax = 100_000;

        test(
            "Kraken returns a sane ETH/USD spot price",
            async () => {
                const price = await getEthPriceKraken(Currency.USD);
                expectInRange(price, ethUsdMin, ethUsdMax, "ETH/USD (Kraken)");
            },
            testTimeout,
        );

        test(
            "Kraken returns a sane ETH/EUR spot price",
            async () => {
                const price = await getEthPriceKraken(Currency.EUR);
                expectInRange(price, ethUsdMin, ethUsdMax, "ETH/EUR (Kraken)");
            },
            testTimeout,
        );

        test(
            "ETH failover returns a sane price in USD",
            async () => {
                const price = await getEthPriceFailover(Currency.USD);
                expectInRange(
                    price,
                    ethUsdMin,
                    ethUsdMax,
                    "ETH/USD (failover)",
                );
            },
            testTimeout,
        );
    });

    describe("Gas tokens (Kraken / failover)", () => {
        test(
            "Kraken-backed gas token (ETH) returns a sane price in EUR",
            async () => {
                const price = await getGasTokenPriceKraken("ETH", Currency.EUR);
                expectInRange(price, 100, 100_000, "ETH/EUR (gas Kraken)");
            },
            testTimeout,
        );

        test(
            "Gas-token failover routes RBTC through the BTC providers",
            async () => {
                const price = await getGasTokenPriceFailover(
                    "RBTC",
                    Currency.USD,
                );
                expectInRange(price, 1_000, 1_000_000, "RBTC/USD (failover)");
            },
            testTimeout,
        );
    });

    describe("CoinGecko endpoints (paced)", () => {
        beforeEach(async () => {
            await sleep(coinGeckoCooldown);
        });

        test(
            "CoinGecko returns a sane ETH/USD spot price",
            { timeout: testTimeout, retry: coinGeckoRetry },
            async (ctx) => {
                try {
                    const price = await getEthPriceCoinGecko(Currency.USD);
                    expectInRange(price, 100, 100_000, "ETH/USD (CoinGecko)");
                } catch (e) {
                    skipIfCoinGeckoThrottled(ctx, e);
                }
            },
        );

        test(
            "CoinGecko returns a sane SOL/USD spot price",
            { timeout: testTimeout, retry: coinGeckoRetry },
            async (ctx) => {
                try {
                    const price = await getGasTokenPriceCoinGecko(
                        "SOL",
                        Currency.USD,
                    );
                    expectInRange(price, 1, 10_000, "SOL/USD (CoinGecko)");
                } catch (e) {
                    skipIfCoinGeckoThrottled(ctx, e);
                }
            },
        );

        test(
            "CoinGecko returns a sane POL/USD spot price",
            { timeout: testTimeout, retry: coinGeckoRetry },
            async (ctx) => {
                try {
                    const price = await getGasTokenPriceCoinGecko(
                        "POL",
                        Currency.USD,
                    );
                    expectInRange(price, 0.01, 100, "POL/USD (CoinGecko)");
                } catch (e) {
                    skipIfCoinGeckoThrottled(ctx, e);
                }
            },
        );

        test(
            "Gas-token failover prices a stablecoin (USDT0) near 1 USD",
            { timeout: testTimeout, retry: coinGeckoRetry },
            async (ctx) => {
                try {
                    const price = await getGasTokenPriceFailover(
                        "USDT0",
                        Currency.USD,
                    );
                    expectInRange(price, 0.5, 2, "USDT0/USD (failover)");
                } catch (e) {
                    skipIfCoinGeckoThrottled(ctx, e);
                }
            },
        );
    });
});
