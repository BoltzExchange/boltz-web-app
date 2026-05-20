import { render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { createSignal } from "solid-js";

import { USDT0, WBTC } from "../../src/consts/Assets";
import { Currency } from "../../src/consts/Enums";
import type { FiatContextType } from "../../src/context/Fiat";

const { fiatContextMock } = vi.hoisted(() => ({
    fiatContextMock: {
        value: undefined as FiatContextType | undefined,
    },
}));

vi.mock("../../src/context/Fiat", () => ({
    useFiatContext: () => fiatContextMock.value,
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        t: (key: string) => key,
    }),
}));

const FiatAmount = (await import("../../src/components/FiatAmount")).default;

describe("FiatAmount", () => {
    afterEach(() => {
        fiatContextMock.value = undefined;
    });

    const renderAmount = (
        asset: string,
        amount: number,
        context: Partial<FiatContextType>,
    ) => {
        const [btcPrice] = createSignal<BigNumber | Error | null>(
            BigNumber(95_000),
        );
        const [fiatCurrency] = createSignal(Currency.EUR);
        const [usdToFiatRate] = createSignal<BigNumber | null>(null);

        fiatContextMock.value = {
            btcPrice,
            fiatCurrency,
            usdToFiatRate,
            fetchBtcPrice: vi.fn(),
            setFiatCurrency: vi.fn(),
            ...context,
        };

        render(() => (
            <FiatAmount asset={() => asset} amount={amount} variant="text" />
        ));
    };

    const renderStablecoinAmount = (context: Partial<FiatContextType>) =>
        renderAmount(USDT0, 100_000_000, context);

    test("should not label USD stablecoin face values as EUR without a conversion rate", () => {
        renderStablecoinAmount({});

        expect(screen.getByText("fiat_rate_not_available")).toBeInTheDocument();
        expect(screen.queryByText(/100\.00 EUR/)).toBeNull();
    });

    test("should convert USD stablecoin face values to EUR when the rate is available", () => {
        const [usdToFiatRate] = createSignal<BigNumber | null>(BigNumber(0.92));

        renderStablecoinAmount({ usdToFiatRate });

        expect(screen.getByText(/92\.00 EUR/)).toBeInTheDocument();
    });

    test("should treat WBTC amounts as sats for fiat conversion", () => {
        renderAmount(WBTC, 100_000_000, {});

        expect(screen.getByText(/95000\.00 EUR/)).toBeInTheDocument();
    });
});
