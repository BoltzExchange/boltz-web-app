import { render, screen } from "@solidjs/testing-library";

import i18n from "../../src/i18n/i18n";
import Refund from "../../src/pages/Refund";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

describe("Refund", () => {
    test("should render WASM error", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Refund />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setWasmSupported(false);
        expect(
            await screen.findAllByText(i18n.en.error_wasm),
        ).not.toBeUndefined();
    });
});
