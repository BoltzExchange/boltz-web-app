import { Router } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, test } from "vitest";

import Nav from "../../src/components/Nav";

describe("Nav", () => {
    test.each(["testnet", "regtest", "random"])(
        "should show network on network %s",
        async (network) => {
            render(() => (
                <Router>
                    <Nav network={network} />
                </Router>
            ));

            const networkLabel = screen.queryAllByText(network);
            expect(networkLabel.length).toBe(1);
        },
    );

    test("should not show network on mainnet", async () => {
        const network = "main";

        render(() => (
            <Router>
                <Nav network={network} />
            </Router>
        ));

        const networkLabel = screen.queryAllByText(network);
        expect(networkLabel.length).toBe(0);
    });
});
