import { render, screen } from "@solidjs/testing-library";
import { BridgeKind, SwapPosition, SwapType } from "boltz-swaps/types";

import { chooseUrl, config } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { USDC, USDT0 } from "../../src/consts/Assets";
import SwapRefunded from "../../src/status/SwapRefunded";
import type { SomeSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper, payContext } from "../helper";

const refundTxId = "0xrefund";

const oftBridge = {
    kind: BridgeKind.Oft,
    sourceAsset: "USDT0-POL",
    destinationAsset: USDT0,
};

const cctpBridge = {
    kind: BridgeKind.Cctp,
    sourceAsset: "USDC-POL",
    destinationAsset: USDC,
};

const swap = (assetSend: string, bridge?: object) =>
    ({
        type: SwapType.Submarine,
        assetSend,
        assetReceive: "BTC",
        refundTx: refundTxId,
        dex: { hops: [], position: SwapPosition.Pre, quoteAmount: 0 },
        bridge,
    }) as unknown as SomeSwap;

const preBridgedSwap = (bridge: typeof oftBridge, txHash?: string) =>
    swap(bridge.destinationAsset, {
        ...bridge,
        position: SwapPosition.Pre,
        txHash,
    });

const assetExplorerLink = (asset: string) =>
    `${chooseUrl(config.assets![asset]!.blockExplorerUrl)}/tx/${refundTxId}`;

const expectLink = async (href: string) => {
    expect(await screen.findByRole("link")).toHaveAttribute("href", href);
};

const renderRefunded = (refunded: SomeSwap) => {
    render(
        () => (
            <>
                <TestComponent />
                <SwapRefunded refundTxId={refundTxId} />
            </>
        ),
        { wrapper: contextWrapper },
    );
    payContext.setSwap(refunded);
};

describe("SwapRefunded", () => {
    beforeEach(() => {
        for (const { sourceAsset } of [oftBridge, cctpBridge]) {
            config.assets![sourceAsset] ??= structuredClone(
                mainnetConfig.assets![sourceAsset],
            );
        }
    });

    test("links a bridged back refund to the LayerZero explorer", async () => {
        renderRefunded(preBridgedSwap(oftBridge, "0xbridge"));

        await expectLink(`${config.layerZeroExplorerUrl}/tx/${refundTxId}`);
    });

    test("links a bridged back refund to the CCTP explorer", async () => {
        renderRefunded(preBridgedSwap(cctpBridge, "0xbridge"));

        await expectLink(
            `${config.cctpExplorerUrl}/messages?transactionHash=${refundTxId}`,
        );
    });

    test("links to the lockup chain explorer without a bridge back", async () => {
        renderRefunded(preBridgedSwap(oftBridge));

        await expectLink(assetExplorerLink(USDT0));
    });

    test("links to the lockup chain explorer without a bridge", async () => {
        renderRefunded(swap(USDT0));

        await expectLink(assetExplorerLink(USDT0));
    });
});
