import { render, screen } from "@solidjs/testing-library";

import Nav from "../../src/components/Nav";
import mainnetConfig from "../../src/configs/mainnet.json";
import { contextWrapper } from "../helper";

describe("Nav", () => {
    test.each(["testnet", "regtest", "random"])(
        "should show network on network %s",
        async (network) => {
            render(() => <Nav network={network} />, {
                wrapper: contextWrapper,
            });

            const networkLabel = screen.queryAllByText(network);
            expect(networkLabel.length).toBe(1);
        },
    );

    test("should not show network on mainnet", async () => {
        const network = mainnetConfig.network;

        render(() => <Nav network={network} />, { wrapper: contextWrapper });

        const networkLabel = screen.queryAllByText(network);
        expect(networkLabel.length).toBe(0);
    });
});
