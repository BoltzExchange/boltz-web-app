import { fireEvent, render, screen } from "@solidjs/testing-library";

import SettingsMenu from "../../src/components/settings/SettingsMenu";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

describe("SettingsMenu", () => {
    test("should close when Escape key is pressed", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SettingsMenu />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setSettingsMenu(true);

        fireEvent.keyDown(document, { key: "Escape" });

        expect(globalSignals.settingsMenu()).toBe(false);
    });

    test("should toggle bitcoinOnly on click", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SettingsMenu />
                </>
            ),
            { wrapper: contextWrapper },
        );

        globalSignals.setSettingsMenu(true);
        globalSignals.setBitcoinOnly(false);

        const toggle = await screen.findByTestId("bitcoin-only-toggle");

        fireEvent.click(toggle);
        expect(globalSignals.bitcoinOnly()).toBe(true);

        fireEvent.click(toggle);
        expect(globalSignals.bitcoinOnly()).toBe(false);
    });
});
