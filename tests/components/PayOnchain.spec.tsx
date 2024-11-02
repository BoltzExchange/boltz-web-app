import { fireEvent, render, screen } from "@solidjs/testing-library";

import PayOnchain from "../../src/components/PayOnchain";
import { BTC } from "../../src/consts/Assets";
import { Denomination } from "../../src/consts/Enums";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

/* eslint-disable @typescript-eslint/unbound-method */

describe("PayOnchain", () => {
    test("should copy amount reactively", async () => {
        const amount = 100_000;

        render(
            () => (
                <>
                    <TestComponent />
                    <PayOnchain
                        asset={BTC}
                        address={"btc1"}
                        bip21={"bitcoin:bc1"}
                        expectedAmount={amount}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        navigator.clipboard = {
            writeText: jest.fn(),
        } as unknown;

        const buttons = (await screen.findByTestId(
            "pay-onchain-buttons",
        )) as HTMLDivElement;
        expect(buttons).not.toBeUndefined();

        globalSignals.setSeparator(".");
        globalSignals.setDenomination(Denomination.Sat);
        fireEvent.click(buttons.children[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            String(amount),
        );

        globalSignals.setDenomination(Denomination.Btc);
        fireEvent.click(buttons.children[0]);

        expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            String(amount / 10 ** 8),
        );
    });
});
