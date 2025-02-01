import { fireEvent, render, screen } from "@solidjs/testing-library";

import Denomination from "../../src/components/settings/Denomination";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

describe("Denomination", () => {
    test("should change denomination on button click", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Denomination />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const btcDenomination = (await screen.findByTestId(
            "btc-denomination-button",
        )) as HTMLDivElement;
        const satsDenomination = (await screen.findByTestId(
            "sats-denomination-button",
        )) as HTMLDivElement;

        expect(btcDenomination.classList.contains("active")).toBeFalsy();
        expect(satsDenomination.classList.contains("active")).toBeTruthy();
        expect(globalSignals.denomination()).toEqual("sat");

        fireEvent.click(btcDenomination);

        expect(btcDenomination.classList.contains("active")).toBeTruthy();
        expect(satsDenomination.classList.contains("active")).toBeFalsy();
        expect(globalSignals.denomination()).toEqual("btc");
    });
});
