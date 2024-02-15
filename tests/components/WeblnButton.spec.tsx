import { render, screen } from "@solidjs/testing-library";
import { BigNumber } from "bignumber.js";

import WeblnButton from "../../src/components/WeblnButton";
import i18n from "../../src/i18n/i18n";
import { TestComponent, contextWrapper, signals } from "../helper";

describe("WeblnButton", () => {
    test("should render WeblnButton", async () => {
        render(() => <WeblnButton />, {
            wrapper: contextWrapper,
        });
    });

    test.each`
        value
        ${true}
        ${false}
    `(
        "should be enabled = $value with valid= $value amount",
        async ({ value }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <WeblnButton />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            signals.setReceiveAmount(BigNumber(1));
            signals.setAmountValid(value);

            const button = (await screen.findByText(
                i18n.en.create_invoice_webln,
            )) as HTMLButtonElement;

            expect(button.disabled).toEqual(!value);
        },
    );

    test("should be enabled for 0 amount", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <WeblnButton />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        signals.setAmountValid(false);
        signals.setReceiveAmount(BigNumber(0));

        const button = (await screen.findByText(
            i18n.en.create_invoice_webln,
        )) as HTMLButtonElement;

        expect(button.disabled).toEqual(false);
    });
});
