import { I18nContext } from "@solid-primitives/i18n";
import { render, screen } from "@solidjs/testing-library";
import i18n from "../../src/i18n/i18n";
import createI18n from "../../src/i18n";

import Error from "../../src/Error";

describe("Error", () => {
    test("should render the Error page", async () => {
        render(() => (
            <I18nContext.Provider value={createI18n()}>
                <Error />
            </I18nContext.Provider>
        ));
        const headline = await screen.findByText(i18n.en.error);
        expect(headline).not.toBeUndefined();
        const text = await screen.findByText(i18n.en.error_subline);
        expect(text).not.toBeUndefined();
    });
});
