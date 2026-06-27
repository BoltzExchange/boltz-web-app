import { render, screen } from "@solidjs/testing-library";

import i18n from "../../src/i18n/i18n";
import Broadcasting from "../../src/status/Broadcasting";
import { contextWrapper } from "../helper";

describe("Broadcasting", () => {
    test("renders the broadcasting claim heading", () => {
        render(() => <Broadcasting />, { wrapper: contextWrapper });

        expect(
            screen.getByText(i18n.en.broadcasting_claim),
        ).toBeInTheDocument();
    });

    test("renders a loading spinner while broadcasting", () => {
        render(() => <Broadcasting />, { wrapper: contextWrapper });

        expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });
});
