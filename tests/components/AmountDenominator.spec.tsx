import { render, screen } from "@solidjs/testing-library";

import AmountDenominator from "../../src/components/AmountDenominator";
import { ETH } from "../../src/consts/Assets";
import { Denomination } from "../../src/consts/Enums";

describe("AmountDenominator", () => {
    test.each([Denomination.Btc, "USDT"])(
        "renders %s as an icon denominator",
        (value) => {
            const { container } = render(() => (
                <AmountDenominator class="extra" value={value} />
            ));

            const icon = container.querySelector(".denominator.extra");
            expect(icon).not.toBeNull();
            expect(icon).toHaveAttribute("data-denominator", value);
        },
    );

    test("renders ETH as its symbol", () => {
        render(() => <AmountDenominator class="extra" value={ETH} />);

        const symbol = screen.getByText("Ξ");
        expect(symbol).toHaveClass("denominator-text");
        expect(symbol).toHaveClass("denominator-text-symbol");
        expect(symbol).toHaveClass("extra");
    });

    test("renders unsupported denominators as text", () => {
        render(() => <AmountDenominator value="SOL" />);

        const text = screen.getByText("SOL");
        expect(text).toHaveClass("denominator-text");
        expect(text).not.toHaveClass("denominator-text-symbol");
    });
});
