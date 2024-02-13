import { render, screen } from "@solidjs/testing-library";

import i18n from "../../src/i18n/i18n";
import ErrorWasm from "../../src/pages/ErrorWasm";
import { contextWrapper } from "../helper";

describe("ErrorWasm", () => {
    test("should render the ErrorWasm page", async () => {
        render(() => <ErrorWasm />, {
            wrapper: contextWrapper,
        });
        const headline = await screen.findByText(i18n.en.error_wasm);
        expect(headline).not.toBeUndefined();
        const text = await screen.findByText(i18n.en.wasm_not_supported);
        expect(text).not.toBeUndefined();
    });
});
