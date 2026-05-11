import { render, screen } from "@solidjs/testing-library";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../../src/components/BlockExplorer";
import { config } from "../../src/config";
import { NetworkTransport } from "../../src/configs/base";
import * as assets from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import { ExplorerKind } from "../../src/utils/explorerLink";
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
        render(
            () => (
                <BlockExplorer
                    asset={asset}
                    kind={BlockExplorerTargetKind.Address}
                    id={address}
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

        const button = await screen.findByText(
            i18n.en.blockexplorer.replace(
                "{{ typeLabel }}",
                i18n.en.blockexplorer_lockup_address,
            ),
        );
        const baseLink = config.assets![asset].blockExplorerUrl!.normal;
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
        render(
            () => (
                <BlockExplorer
                    asset={asset}
                    kind={BlockExplorerTargetKind.Tx}
                    id={txId}
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
        const baseLink = config.assets![asset].blockExplorerUrl!.normal;
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
                    kind={BlockExplorerTargetKind.Tx}
                    id={txId}
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

    test("should link CCTP bridge transactions when requested", async () => {
        const txId =
            "0x3ca4451e3008d523eec1c64e617663894e47cabd335654bd9f65724772682de8";

        render(
            () => (
                <BlockExplorer
                    asset="USDC-BASE"
                    kind={BlockExplorerTargetKind.Tx}
                    id={txId}
                    explorer={ExplorerKind.Cctp}
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
            `${config.cctpExplorerUrl}/messages?transactionHash=${txId}`,
        );
    });

    test.each`
        explorer                  | baseUrl
        ${ExplorerKind.LayerZero} | ${() => config.layerZeroExplorerUrl}
        ${ExplorerKind.Cctp}      | ${() => config.cctpExplorerUrl}
    `(
        "should render the bridge status label for $explorer",
        async ({ explorer, baseUrl }) => {
            const txId =
                "0x3ca4451e3008d523eec1c64e617663894e47cabd335654bd9f65724772682de8";

            render(
                () => (
                    <BlockExplorer
                        asset="USDT0"
                        kind={BlockExplorerTargetKind.Tx}
                        id={txId}
                        explorer={explorer}
                        typeLabel="bridge_status"
                    />
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            const button = (await screen.findByText(
                i18n.en.check_bridge_status,
            )) as HTMLAnchorElement;

            expect(button).not.toBeUndefined();
            expect(button.textContent).not.toContain("{{");

            const expectedPath =
                explorer === ExplorerKind.Cctp
                    ? `messages?transactionHash=${txId}`
                    : `tx/${txId}`;
            expect(button.href).toEqual(`${baseUrl()}/${expectedPath}`);
        },
    );

    test("does not render a link when no explorer base URL is configured", () => {
        const { container } = render(
            () => (
                <BlockExplorer
                    asset="UNKNOWN-ASSET"
                    kind={BlockExplorerTargetKind.Tx}
                    id="deadbeef"
                />
            ),
            {
                wrapper: contextWrapper,
            },
        );

        expect(container.querySelector("a.btn-explorer")).toBeNull();
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
                    kind={BlockExplorerTargetKind.Tx}
                    id={txId}
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
