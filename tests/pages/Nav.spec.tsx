import { Router } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";

import Nav from "../../src/components/Nav";
import { GlobalProvider } from "../../src/context/Global";

describe("Nav", () => {
    test.each(["testnet", "regtest", "random"])(
        "should show network on network %s",
        async (network) => {
            render(() => (
                <Router>
                    <GlobalProvider>
                        <Nav network={network} />
                    </GlobalProvider>
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
                <GlobalProvider>
                    <Nav network={network} />
                </GlobalProvider>
            </Router>
        ));

        const networkLabel = screen.queryAllByText(network);
        expect(networkLabel.length).toBe(0);
    });
});
