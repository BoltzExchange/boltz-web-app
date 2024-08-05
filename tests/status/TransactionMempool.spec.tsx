import { render, screen } from "@solidjs/testing-library";

import { BTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import TransactionMempool from "../../src/status/TransactionMempool";
import { TestComponent, contextWrapper, payContext } from "../helper";

describe("TransactionMempool", () => {
    test("should show blockexplorer lockup transaction button", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionMempool />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({
            assetSend: BTC,
        } as any);

        payContext.setSwapStatusTransaction({
            id: "txid",
            hex: "hex",
        });

        const type_label = i18n.en[`blockexplorer_lockup_tx`];
        const label = i18n.en.blockexplorer.replace(
            "{{ typeLabel }}",
            type_label,
        );

        const button = await screen.findByText(label);
        expect(button).not.toBeUndefined();
        expect(button.getAttribute("href")).toMatch("txid");
    });
});
