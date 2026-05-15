import { render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import { Currency } from "../../src/consts/Enums";
import type * as FiatModule from "../../src/utils/fiat";

const { getBtcPriceFailoverMock } = vi.hoisted(() => ({
    getBtcPriceFailoverMock: vi.fn<typeof FiatModule.getBtcPriceFailover>(),
}));

vi.mock("../../src/utils/fiat", async () => {
    const actual = await vi.importActual<typeof FiatModule>(
        "../../src/utils/fiat",
    );

    return {
        ...actual,
        getBtcPriceFailover: getBtcPriceFailoverMock,
    };
});

const { FiatProvider, useFiatContext } = await import("../../src/context/Fiat");

describe("Fiat context", () => {
    let fiatSignals: ReturnType<typeof useFiatContext>;

    const Probe = () => {
        fiatSignals = useFiatContext();
        return null;
    };

    beforeEach(() => {
        getBtcPriceFailoverMock.mockReset();
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    test("fetchBtcPrice should reuse a recent successful price", async () => {
        getBtcPriceFailoverMock
            .mockResolvedValueOnce(BigNumber(111_111))
            .mockResolvedValueOnce(BigNumber(222_222));

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        await fiatSignals.fetchBtcPrice();
        await fiatSignals.fetchBtcPrice();

        expect(getBtcPriceFailoverMock).toHaveBeenCalledTimes(1);
        expect(fiatSignals.btcPrice()?.toString()).toBe("111111");
    });

    test("fetchBtcPrice should set usdToFiatRate to 1 on the USD path with a single fetch", async () => {
        getBtcPriceFailoverMock.mockResolvedValue(BigNumber(100_000));

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        await fiatSignals.fetchBtcPrice();

        expect(getBtcPriceFailoverMock).toHaveBeenCalledTimes(1);
        expect(getBtcPriceFailoverMock).toHaveBeenCalledWith(Currency.USD);
        expect(fiatSignals.usdToFiatRate()?.toString()).toBe("1");
    });

    test("fetchBtcPrice should fetch both currencies and derive usdToFiatRate when non-USD is selected", async () => {
        localStorage.setItem("fiatCurrency", Currency.EUR);

        getBtcPriceFailoverMock.mockImplementation((currency) => {
            if (currency === Currency.EUR)
                return Promise.resolve(BigNumber(92_000));
            if (currency === Currency.USD)
                return Promise.resolve(BigNumber(100_000));
            return Promise.reject(new Error(`unexpected currency ${currency}`));
        });

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        await fiatSignals.fetchBtcPrice();

        expect(getBtcPriceFailoverMock).toHaveBeenCalledTimes(2);
        expect(getBtcPriceFailoverMock).toHaveBeenCalledWith(Currency.EUR);
        expect(getBtcPriceFailoverMock).toHaveBeenCalledWith(Currency.USD);
        expect(fiatSignals.btcPrice()?.toString()).toBe("92000");
        // 92_000 EUR/BTC ÷ 100_000 USD/BTC = 0.92 EUR/USD
        expect(fiatSignals.usdToFiatRate()?.toString()).toBe("0.92");
    });

    test("fetchBtcPrice should null usdToFiatRate when the USD failover fails for a non-USD currency", async () => {
        localStorage.setItem("fiatCurrency", Currency.EUR);

        getBtcPriceFailoverMock.mockImplementation((currency) => {
            if (currency === Currency.EUR)
                return Promise.resolve(BigNumber(92_000));
            return Promise.reject(new Error("usd failover down"));
        });

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        await fiatSignals.fetchBtcPrice();

        expect(fiatSignals.btcPrice()?.toString()).toBe("92000");
        expect(fiatSignals.usdToFiatRate()).toBeNull();
    });

    test("fetchBtcPrice should retry when a recent fetch left usdToFiatRate null for a non-USD currency", async () => {
        localStorage.setItem("fiatCurrency", Currency.EUR);

        let usdCalls = 0;
        getBtcPriceFailoverMock.mockImplementation((currency) => {
            if (currency === Currency.EUR)
                return Promise.resolve(BigNumber(92_000));
            usdCalls += 1;
            return usdCalls === 1
                ? Promise.reject(new Error("usd failover down"))
                : Promise.resolve(BigNumber(100_000));
        });

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        await fiatSignals.fetchBtcPrice();
        expect(fiatSignals.usdToFiatRate()).toBeNull();

        await fiatSignals.fetchBtcPrice();

        expect(usdCalls).toBe(2);
        expect(fiatSignals.usdToFiatRate()?.toString()).toBe("0.92");
    });

    test("changing fiatCurrency should invalidate the cache and refetch", async () => {
        let resolveEurPrice: (price: BigNumber) => void = () => {};
        const eurPrice = new Promise<BigNumber>((resolve) => {
            resolveEurPrice = resolve;
        });

        getBtcPriceFailoverMock.mockImplementation((currency) => {
            if (currency === Currency.EUR) {
                return eurPrice;
            }

            return Promise.resolve(BigNumber(100_000));
        });

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        await fiatSignals.fetchBtcPrice();
        expect(getBtcPriceFailoverMock).toHaveBeenCalledTimes(1);

        fiatSignals.setFiatCurrency(Currency.EUR);

        await vi.waitFor(() => {
            expect(fiatSignals.btcPrice()).toBeNull();
        });
        expect(fiatSignals.usdToFiatRate()).toBeNull();

        resolveEurPrice(BigNumber(92_000));

        await vi.waitFor(() => {
            expect(fiatSignals.btcPrice()?.toString()).toBe("92000");
        });
        expect(getBtcPriceFailoverMock).toHaveBeenCalledWith(Currency.EUR);
        expect(getBtcPriceFailoverMock).toHaveBeenCalledWith(Currency.USD);
        expect(fiatSignals.usdToFiatRate()?.toString()).toBe("0.92");
    });

    test("fetchBtcPrice should ignore stale results when fiatCurrency changes", async () => {
        let resolveUsdPrice: (price: BigNumber) => void = () => {};
        const usdPrice = new Promise<BigNumber>((resolve) => {
            resolveUsdPrice = resolve;
        });
        let resolveEurUsdPrice: (price: BigNumber) => void = () => {};
        const eurUsdPrice = new Promise<BigNumber>((resolve) => {
            resolveEurUsdPrice = resolve;
        });
        let usdCalls = 0;

        getBtcPriceFailoverMock.mockImplementation((currency) => {
            if (currency === Currency.USD) {
                usdCalls += 1;
                return usdCalls === 1 ? usdPrice : eurUsdPrice;
            }

            return Promise.resolve(BigNumber(92_000));
        });

        render(() => (
            <FiatProvider>
                <Probe />
            </FiatProvider>
        ));

        const staleFetch = fiatSignals.fetchBtcPrice();
        fiatSignals.setFiatCurrency(Currency.EUR);
        resolveUsdPrice(BigNumber(100_000));
        await staleFetch;

        expect(fiatSignals.btcPrice()).toBeNull();

        resolveEurUsdPrice(BigNumber(100_000));

        await vi.waitFor(() => {
            expect(fiatSignals.btcPrice()?.toString()).toBe("92000");
        });
    });
});
