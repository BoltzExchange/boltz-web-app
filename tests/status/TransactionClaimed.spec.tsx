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

    // The sat denomination groups digits with spaces
    const claimedAmountText = async () =>
        (await screen.findByText(/You successfully received/u))
            .textContent!.match(/received ([\d ]+)/u)![1]
            .replaceAll(" ", "");

    const liquidRegtest = {
        unconfidential: "ert1q0k9g02evldg5eylnd8lrch0awd05u89p9len8l",
        confidential:
            "el1qqgept38a77emd94r554av0ptj4eelxnx5z9wekxmynd2qe4wvunhylv2s74je763fjflx60783wl6u6lfcw2zjc5pm5n3gq32",
    };

    // `receiveAmount` is what the claim requests; an unconfidential Liquid
    // destination reserves the surcharge out of it
    test.each`
        name                        | swap                                                                                                                                                                 | shown
        ${"unconfidential L-BTC"}   | ${{ type: SwapType.Reverse, assetReceive: LBTC, claimTx: "txid", claimAddress: liquidRegtest.unconfidential, blindingKey: "00".repeat(32), receiveAmount: 100_000 }} | ${"99994"}
        ${"confidential L-BTC"}     | ${{ type: SwapType.Reverse, assetReceive: LBTC, claimTx: "txid", claimAddress: liquidRegtest.confidential, blindingKey: "00".repeat(32), receiveAmount: 100_000 }}   | ${"100000"}
        ${"L-BTC without blinding"} | ${{ type: SwapType.Reverse, assetReceive: LBTC, claimTx: "txid", claimAddress: liquidRegtest.unconfidential, receiveAmount: 100_000 }}                               | ${"100000"}
        ${"BTC"}                    | ${{ type: SwapType.Reverse, assetReceive: BTC, claimTx: "txid", claimAddress: "bcrt1qxyz", receiveAmount: 100_000 }}                                                 | ${"100000"}
    `("shows the landed amount for $name", async ({ swap, shown }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionClaimed />
                </>
            ),
            { wrapper: contextWrapper },
        );
        payContext.setSwap(swap as SomeSwap);

        expect(await claimedAmountText()).toBe(shown);
    });

    test("leaves a post-position DEX output untouched", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionClaimed />
                </>
            ),
            { wrapper: contextWrapper },
        );
        payContext.setSwap({
            type: SwapType.Reverse,
            assetReceive: LBTC,
            claimTx: "txid",
            claimAddress: liquidRegtest.unconfidential,
            blindingKey: "00".repeat(32),
            receiveAmount: 100_000,
            dex: {
                position: SwapPosition.Post,
                quoteAmount: 42_000,
                hops: [{ to: BTC }],
            },
        } as unknown as SomeSwap);

        expect(await claimedAmountText()).toBe("42000");
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
