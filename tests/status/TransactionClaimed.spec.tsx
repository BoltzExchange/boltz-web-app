import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC, LN, RBTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import TransactionClaimed from "../../src/status/TransactionClaimed";
import { TestComponent, contextWrapper, payContext } from "../helper";

describe("TransactionClaimed", () => {
    test.each`
        name                                                  | swap
        ${"normal swaps"}                                     | ${{ assetSend: RBTC, assetReceive: LN, address: "address" }}
        ${"reverse swaps to RBTC"}                            | ${{ assetSend: LN, assetReceive: RBTC, claimTx: "txid" }}
        ${"reverse swaps to BTC with claim transactions"}     | ${{ assetSend: LN, assetReceive: LBTC, claimTx: "txid" }}
        ${"reverse swaps to L-BTC with claim transactions"}   | ${{ assetSend: LN, assetReceive: BTC, claimTx: "txid" }}
        ${"chain swaps BTC to L-BTC with claim transactions"} | ${{ assetSend: BTC, assetReceive: LBTC, claimTx: "txid" }}
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
