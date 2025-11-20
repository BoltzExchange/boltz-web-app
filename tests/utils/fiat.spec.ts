import { BigNumber } from "bignumber.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { baseConfig } from "../../src/configs/base";
import { Currency } from "../../src/consts/Enums";
import {
    getBtcPriceKraken,
    getBtcPriceMempool,
    getBtcPriceYadio,
} from "../../src/utils/fiat";

describe("fiat utils", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should fetch BTC price from Mempool provider", async () => {
        const mockPrice = 46000;
        const mockResponse = {
            USD: mockPrice,
            EUR: 41000,
        };

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const result = await getBtcPriceMempool(Currency.USD);

        expect(global.fetch).toHaveBeenCalledWith(
            baseConfig.rateProviders.Mempool,
            expect.objectContaining({
                signal: expect.any(AbortSignal),
            }),
        );
        expect(result).toBeInstanceOf(BigNumber);
        expect(result.toNumber()).toBe(mockPrice);
    });

    test("should fetch BTC price from Kraken provider", async () => {
        const mockPrice = "45500.50";
        const mockResponse = {
            result: {
                XXBTZUSD: {
                    c: [mockPrice, "1000"],
                },
            },
        };

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const result = await getBtcPriceKraken(Currency.USD);

        expect(global.fetch).toHaveBeenCalledWith(
            `${baseConfig.rateProviders.Kraken}?pair=XXBTZUSD`,
            expect.objectContaining({
                signal: expect.any(AbortSignal),
            }),
        );
        expect(result).toBeInstanceOf(BigNumber);
        expect(result.toNumber()).toBe(parseFloat(mockPrice));
    });

    test("should fetch BTC price from Yadio provider", async () => {
        const mockPrice = 45000;
        const mockResponse = {
            BTC: {
                USD: mockPrice,
                EUR: 40000,
            },
        };

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const result = await getBtcPriceYadio(Currency.USD);

        expect(global.fetch).toHaveBeenCalledWith(
            baseConfig.rateProviders.Yadio,
            expect.objectContaining({
                signal: expect.any(AbortSignal),
            }),
        );
        expect(result).toBeInstanceOf(BigNumber);
        expect(result.toNumber()).toBe(mockPrice);
    });
});
