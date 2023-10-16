import { Router } from "@solidjs/router";
import { describe, expect } from "vitest";
import { I18nContext } from "@solid-primitives/i18n";
import { render, screen } from "@solidjs/testing-library";
import Nav from "../src/Nav";
import createI18n from "../src/i18n";

describe("Nav", () => {
    test.each(["testnet", "regtest", "random"])(
        "should show network on network %s",
        async (network) => {
            render(() => (
                <I18nContext.Provider value={createI18n()}>
                    <Router>
                        <Nav network={network} />
                    </Router>
                </I18nContext.Provider>
            ));

            const networkLabel = screen.queryAllByText(network);
            expect(networkLabel.length).toBe(1);
        },
    );

    test("should not show network on mainnet", async () => {
        const network = "main";

        render(() => (
            <I18nContext.Provider value={createI18n()}>
                <Router>
                    <Nav network={network} />
                </Router>
            </I18nContext.Provider>
        ));

        const networkLabel = screen.queryAllByText(network);
        expect(networkLabel.length).toBe(0);
    });
});
