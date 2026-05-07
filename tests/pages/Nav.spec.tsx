import { render, screen } from "@solidjs/testing-library";

import Nav from "../../src/components/Nav";
import { contextWrapper } from "../helper";

describe("Nav", () => {
    test.each(["testnet", "regtest", "random"])(
        "should show network on network %s",
        (network) => {
            render(() => <Nav network={network} />, {
                wrapper: contextWrapper,
            });

            const label = network.toUpperCase();
            const networkLabel = screen.queryAllByText(label);
            expect(networkLabel.length).toBe(1);
        },
    );

    test("should not show network on mainnet", () => {
        const network = "mainnet";

        render(() => <Nav network={network} />, { wrapper: contextWrapper });

        const networkLabel = screen.queryAllByText(network);
        expect(networkLabel.length).toBe(0);
    });

    test("should uppercase pro label", () => {
        render(() => <Nav network="mainnet" isPro />, {
            wrapper: contextWrapper,
        });

        const proLabel = screen.queryAllByText("PRO");
        expect(proLabel.length).toBe(1);
    });
});
