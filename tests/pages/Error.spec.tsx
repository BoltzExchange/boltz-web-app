import { render, screen } from "@solidjs/testing-library";

import i18n from "../../src/i18n/i18n";
import Error from "../../src/pages/Error";
import { contextWrapper } from "../helper";

describe("Error", () => {
    test("should render the Error page", async () => {
        render(() => <Error />, {
            wrapper: contextWrapper,
        });
        const headline = await screen.findByText(i18n.en.error);
        expect(headline).not.toBeUndefined();
        const text = await screen.findByText(i18n.en.error_subline);
        expect(text).not.toBeUndefined();
    });
});
