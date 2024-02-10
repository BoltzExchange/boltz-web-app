import { render, screen } from "@solidjs/testing-library";

import { GlobalProvider } from "../../src/context/Global";
import i18n from "../../src/i18n/i18n";
import Error from "../../src/pages/Error";

describe("Error", () => {
    test("should render the Error page", async () => {
        render(() => (
            <GlobalProvider>
                <Error />
            </GlobalProvider>
        ));
        const headline = await screen.findByText(i18n.en.error);
        expect(headline).not.toBeUndefined();
        const text = await screen.findByText(i18n.en.error_subline);
        expect(text).not.toBeUndefined();
    });
});
