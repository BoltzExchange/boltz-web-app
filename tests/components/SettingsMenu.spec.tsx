import { fireEvent, render } from "@solidjs/testing-library";

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
});
