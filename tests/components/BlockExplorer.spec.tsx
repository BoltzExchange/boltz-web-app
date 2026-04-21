import { render, screen } from "@solidjs/testing-library";

import BlockExplorer, {
    ExplorerKind,
} from "../../src/components/BlockExplorer";
import { config } from "../../src/config";
import { NetworkTransport } from "../../src/configs/base";
import * as assets from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import { contextWrapper } from "../helper";

describe("BlockExplorer", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

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
        const baseLink = config.assets[asset].blockExplorerUrl.normal;
        expect(baseLink).toBeDefined();
        expect(button).not.toBeUndefined();
        expect((button as HTMLAnchorElement).href).toEqual(
            `${baseLink}/address/${address}`,
        );
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
        const baseLink = config.assets[asset].blockExplorerUrl.normal;
        expect(baseLink).toBeDefined();
        expect(button).not.toBeUndefined();
        expect((button as HTMLAnchorElement).href).toEqual(
            `${baseLink}/tx/${txId}`,
        );
    });

    test("should link LayerZero transactions when requested", async () => {
        const txId =
            "813c90372c9b774396c66099cf8015f9510a8ba5686cbb78d8e848959fe7bb5d";

        render(
            () => (
                <BlockExplorer
                    asset="BTC"
                    txId={txId}
                    explorer={ExplorerKind.LayerZero}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const button = await screen.findByText(
            i18n.en.blockexplorer.replace(
                "{{ typeLabel }}",
                i18n.en.blockexplorer_claim_tx,
            ),
        );

        expect(button).not.toBeUndefined();
        expect((button as HTMLAnchorElement).href).toEqual(
            `${config.layerZeroExplorerUrl}/tx/${txId}`,
        );
    });

    test("should prefix Tron LayerZero transaction hashes with 0x", async () => {
        const txId =
            "2ae5f8e33daf1d608f7aad172b52fb00dbf98a43735c2ed07e203049bcc19815";
        vi.spyOn(assets, "getNetworkTransport").mockReturnValue(
            NetworkTransport.Tron,
        );

        render(
            () => (
                <BlockExplorer
                    asset="USDT0-TRON"
                    txId={txId}
                    explorer={ExplorerKind.LayerZero}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const button = await screen.findByText(
            i18n.en.blockexplorer.replace(
                "{{ typeLabel }}",
                i18n.en.blockexplorer_claim_tx,
            ),
        );

        expect((button as HTMLAnchorElement).href).toEqual(
            `${config.layerZeroExplorerUrl}/tx/0x${txId}`,
        );
    });
});
