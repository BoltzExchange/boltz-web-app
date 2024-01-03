import { Router } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";
import { describe, expect } from "vitest";

import Nav from "../src/Nav";

describe("Nav", () => {
    test.each(["testnet", "regtest", "random"])(
        "should show network on network %s",
        async (network) => {
            render(() => <Router root={() => <Nav network={network} />} />);

            const networkLabel = screen.queryAllByText(network);
            expect(networkLabel.length).toBe(1);
        },
    );

    test("should not show network on mainnet", async () => {
        const network = "main";
        render(() => <Router root={() => <Nav network={network} />} />);

        const networkLabel = screen.queryAllByText(network);
        expect(networkLabel.length).toBe(0);
    });
});
