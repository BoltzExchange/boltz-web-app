import { render, screen } from "@solidjs/testing-library";

import WeblnButton from "../../src/components/WeblnButton";
import { useCreateContext } from "../../src/context/Create";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

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
    `("should be enabled/disabled with in/valid amount", async ({ value }) => {
        const TestComponent = () => {
            const signals = useCreateContext();
            signals.setSendAmountValid(value);
            return "";
        };

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

        const button = (await screen.findByText(
            i18n.en.create_invoice_webln,
        )) as HTMLInputElement;

        expect(button.disabled).toEqual(!value);
    });
});
