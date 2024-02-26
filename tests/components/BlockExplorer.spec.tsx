import { render, screen } from "@solidjs/testing-library";

import BlockExplorer from "../../src/components/BlockExplorer";
import { config } from "../../src/config";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

describe("BlockExplorer", () => {
    test.each`
        asset      | address
        ${"BTC"}   | ${"bcrt1qh47qjmkkdxmg8cjxhe7gnnuluwddcw692cfjsv"}
        ${"L-BTC"} | ${"el1qqfvxkyk2973r8y0dd42ce34r33gplzaharn0sj69qs6gvkua0r0evkk6skde36hgfx2gufy8s8ppdz54kqwkcn9az63n5pcj3"}
    `("should link to $asset addresses", async ({ asset, address }) => {
        render(() => <BlockExplorer asset={asset} address={address} />, {
            wrapper: contextWrapper,
        });

        const button = await screen.findByText(
            i18n.en.blockexplorer.replace(
                "{{ typeLabel }}",
                i18n.en.blockexplorer_lockup_address,
            ),
        );

        const baseLink = config().assets[asset].blockExplorerUrl;
        expect(baseLink).toBeDefined();
        expect(button).not.toBeUndefined();
        expect((button as any).href).toEqual(`${baseLink}/address/${address}`);
    });

    test.each`
        asset      | txId
        ${"BTC"}   | ${"813c90372c9b774396c66099cf8015f9510a8ba5686cbb78d8e848959fe7bb5d"}
        ${"L-BTC"} | ${"9193b769c217808a17a86890195851eab78fdfd2f14d877163587327620324af"}
    `("should link to $asset transactions", async ({ asset, txId }) => {
        render(() => <BlockExplorer asset={asset} txId={txId} />, {
            wrapper: contextWrapper,
        });

        const button = await screen.findByText(
            i18n.en.blockexplorer.replace(
                "{{ typeLabel }}",
                i18n.en.blockexplorer_claim_tx,
            ),
        );

        const baseLink = config().assets[asset].blockExplorerUrl;
        expect(baseLink).toBeDefined();
        expect(button).not.toBeUndefined();
        expect((button as any).href).toEqual(`${baseLink}/tx/${txId}`);
    });
});
