import { fireEvent, render } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";
import { describe, expect, test, vitest } from "vitest";

import ClickableAmount from "../../src/components/ClickableAmount";
import t from "../../src/i18n";
import { setDenomination } from "../../src/signals";
import { denominations, formatAmount } from "../../src/utils/denomination";

describe("ClickableAmount", () => {
    test("should show label when defined", async () => {
        const label = "min";
        const { container } = render(() => (
            <ClickableAmount
                label={label}
                onClick={() => false}
                amount={() => 1}
            />
        ));
        expect(container.innerHTML.startsWith(t(label))).toBeTruthy();
    });

    test.each`
        denomination
        ${denominations.btc}
        ${denominations.sat}
    `("should format amount $denomination", ({ denomination }) => {
        setDenomination(denomination);

        const amount = BigNumber(1_000_00);
        const { container } = render(() => (
            <ClickableAmount
                onClick={() => false}
                label={"test"}
                amount={() => amount}
            />
        ));
        const child = container.children[0];
        expect(child.innerHTML).toEqual(formatAmount(amount, denomination));
    });

    test.each`
        denomination
        ${denominations.btc}
        ${denominations.sat}
    `(
        "should callback with unformatted amount for $denomination",
        ({ denomination }) => {
            setDenomination(denomination);

            const amount = BigNumber(1_000_00);
            const callback = vitest.fn();

            const { container } = render(() => (
                <ClickableAmount
                    onClick={callback}
                    label={"test"}
                    amount={() => amount}
                />
            ));
            const child = container.children[0];
            fireEvent.click(child);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(amount);
        },
    );
});
