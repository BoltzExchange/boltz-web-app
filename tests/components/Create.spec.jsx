import { I18nContext } from "@solid-primitives/i18n";
import { Router } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import i18n from "../../src/i18n/i18n";
import createI18n from "../../src/i18n";
import Create from "../../src/Create";

describe("Create", () => {
    test("should render Create", async () => {
        render(() => (
            <I18nContext.Provider value={createI18n()}>
                <Router>
                    <Create />
                </Router>
            </I18nContext.Provider>
        ));
        const button = await screen.findAllByText(i18n.en.create_swap);
        expect(button).not.toBeUndefined();
    });
});
