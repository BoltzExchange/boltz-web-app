import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import TransactionClaimed from "../../src/status/TransactionClaimed";
import { TestComponent, contextWrapper, payContext } from "../helper";

jest.mock("../../src/utils/boltzClient", () => ({
    getReverseTransaction: jest.fn().mockResolvedValue({
        hex: "txHex",
    }),
}));

describe("TransactionClaimed", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each`
        name                                                | swap
        ${"normal swaps"}                                   | ${{ type: SwapType.Submarine }}
        ${"reverse swaps to RBTC"} | ${{
    type: SwapType.Reverse,
    assetReceive: RBTC,
}}
        ${"reverse swaps to BTC with claim transactions"}   | ${{ type: SwapType.Reverse, assetReceive: BTC, claimTx: "txid" }}
        ${"reverse swaps to L-BTC with claim transactions"} | ${{ type: SwapType.Reverse, assetReceive: LBTC, claimTx: "txid" }}
    `("should show success for $name", async ({ swap }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionClaimed />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap(swap);

        await expect(
            screen.findByText(i18n.en.congrats),
        ).resolves.not.toBeUndefined();
    });
});
