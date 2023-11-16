import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, vitest } from "vitest";

import ClickableAmount from "../../src/components/ClickableAmount";
import { setDenomination } from "../../src/signals";
import { denominations, formatAmount } from "../../src/utils/denomination";

describe("ClickableAmount", () => {
    test("should not show label defined", async () => {
        const label = "test";
        const { container } = render(() => (
            <ClickableAmount label={label} amount={() => 1} />
        ));
        expect(container.innerHTML.startsWith(label)).toBeTruthy();
    });

    test("should not show label when undefined", async () => {
        const { container } = render(() => (
            <ClickableAmount amount={() => 1} />
        ));
        expect(container.innerHTML.startsWith("<span")).toBeTruthy();
    });

    test.each`
        denomination
        ${denominations.btc}
        ${denominations.sat}
    `("should format amount $denomination", ({ denomination }) => {
        setDenomination(denomination);

        const amount = 1_000_00;
        const { container } = render(() => (
            <ClickableAmount amount={() => amount} />
        ));
        expect(container.childNodes[0].innerHTML).toEqual(formatAmount(amount));
    });

    test.each`
        denomination
        ${denominations.btc}
        ${denominations.sat}
    `(
        "should callback with unformatted amount for $denomination",
        ({ denomination }) => {
            setDenomination(denomination);

            const amount = 1_000_00;
            const callback = vitest.fn();

            const { container } = render(() => (
                <ClickableAmount amount={() => amount} onClick={callback} />
            ));
            fireEvent.click(container.childNodes[0]);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(amount);
        },
    );
});
