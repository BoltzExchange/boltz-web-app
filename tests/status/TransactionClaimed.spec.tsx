import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC, LN, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import TransactionClaimed from "../../src/status/TransactionClaimed";
import { TestComponent, contextWrapper, payContext } from "../helper";

describe("TransactionClaimed", () => {
    test.each`
        name                                                  | label               | swap
        ${"normal swaps"}                                     | ${"lockup_address"} | ${{ type: SwapType.Submarine, assetSend: RBTC, assetReceive: LN, address: "bc12" }}
        ${"reverse swaps to RBTC"}                            | ${"claim_tx"}       | ${{ type: SwapType.Reverse, assetSend: LN, assetReceive: RBTC, claimTx: "txid" }}
        ${"reverse swaps to BTC with claim transactions"}     | ${"claim_tx"}       | ${{ type: SwapType.Reverse, assetSend: LN, assetReceive: LBTC, claimTx: "txid" }}
        ${"reverse swaps to L-BTC with claim transactions"}   | ${"claim_tx"}       | ${{ type: SwapType.Reverse, assetSend: LN, assetReceive: BTC, claimTx: "txid" }}
        ${"chain swaps BTC to L-BTC with claim transactions"} | ${"claim_tx"}       | ${{ type: SwapType.Chain, assetSend: BTC, assetReceive: LBTC, claimTx: "txid" }}
    `("should show success for $name", async ({ label, swap }) => {
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

        const type_label = i18n.en[`blockexplorer_${label}`];
        const _label = i18n.en.blockexplorer.replace(
            "{{ typeLabel }}",
            type_label,
        );
        const address_or_tx =
            swap.type === SwapType.Submarine ? swap.address : swap.claimTx;
        const button = screen.getByText(_label);
        expect(button).not.toBeUndefined();
        expect(button.getAttribute("href")).toMatch(address_or_tx);
    });
});
