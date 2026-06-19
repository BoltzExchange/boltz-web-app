import { render, screen } from "@solidjs/testing-library";
import { SwapPosition, SwapType } from "boltz-swaps/types";

import { config } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, LBTC, RBTC, USDT0 } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import TransactionClaimed from "../../src/status/TransactionClaimed";
import type { SomeSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper, payContext } from "../helper";

vi.mock("../../packages/boltz-swaps/src/client.ts", () => ({
    getReverseTransaction: vi.fn().mockResolvedValue({
        hex: "txHex",
    }),
}));

describe("TransactionClaimed", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        config.assets!["USDT0-ETH"] ??= structuredClone(
            mainnetConfig.assets!["USDT0-ETH"],
        );
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

    test("explains post-bridge delivery is still in progress", async () => {
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
        payContext.setSwap({
            type: SwapType.Reverse,
            assetReceive: USDT0,
            receiveAmount: 123_456,
            claimTx: "0xclaim",
            bridge: {
                kind: "oft",
                sourceAsset: USDT0,
                destinationAsset: "USDT0-ETH",
                position: SwapPosition.Post,
            },
        } as unknown as SomeSwap);

        await expect(
            screen.findByText(
                /Swap complete!.*was sent via the Ethereum bridge/u,
            ),
        ).resolves.not.toBeUndefined();
        expect(screen.queryByText(/You successfully received/u)).toBeNull();
    });
});
