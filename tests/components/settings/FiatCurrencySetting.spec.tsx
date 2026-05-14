import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import { Currency } from "../../../src/consts/Enums";
import type { FiatContextType } from "../../../src/context/Fiat";

const { fiatContextMock } = vi.hoisted(() => ({
    fiatContextMock: {
        value: undefined as FiatContextType | undefined,
    },
}));

vi.mock("../../../src/context/Fiat", () => ({
    useFiatContext: () => fiatContextMock.value,
}));

vi.mock("../../../src/context/Global", () => ({
    useGlobalContext: () => ({ t: (key: string) => key }),
}));

const FiatCurrencySetting = (
    await import("../../../src/components/settings/FiatCurrencySetting")
).default;

describe("FiatCurrencySetting", () => {
    afterEach(() => {
        fiatContextMock.value = undefined;
    });

    const installContext = () => {
        const [fiatCurrency, setFiatCurrency] = createSignal(Currency.USD);

        fiatContextMock.value = {
            fiatCurrency,
            setFiatCurrency,
            btcPrice: () => null,
            usdToFiatRate: () => null,
            showFiatAmount: () => true,
            setShowFiatAmount: vi.fn(),
            fetchBtcPrice: vi.fn(),
        };

        return { fiatCurrency, setFiatCurrency };
    };

    test("should render one option for every Currency enum entry", () => {
        installContext();

        render(() => <FiatCurrencySetting />);

        const select = screen.getByTestId(
            "fiat-currency-select",
        ) as HTMLSelectElement;
        const values = Array.from(select.options).map((opt) => opt.value);
        expect(values).toEqual(Object.values(Currency));
    });

    test("should update fiatCurrency on change", () => {
        const { fiatCurrency } = installContext();

        render(() => <FiatCurrencySetting />);

        const select = screen.getByTestId(
            "fiat-currency-select",
        ) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: Currency.EUR } });

        expect(fiatCurrency()).toBe(Currency.EUR);
    });
});
