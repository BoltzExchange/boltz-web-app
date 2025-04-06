import { render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import BlockExplorerLink from "../../src/components/BlockExplorerLink";
import { config } from "../../src/config";
import { BTC, LBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import type { ChainSwap, SomeSwap } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

describe("BlockExplorerLink", () => {
    describe("Submarine and Reverse Swaps", () => {
        test.each`
            type                  | asset   | address  | params
            ${SwapType.Submarine} | ${BTC}  | ${"bc1"} | ${{ type: SwapType.Submarine, assetSend: BTC, address: "bc1" }}
            ${SwapType.Reverse}   | ${LBTC} | ${"lq1"} | ${{ type: SwapType.Reverse, assetReceive: LBTC, lockupAddress: "lq1" }}
        `(
            "should show lockup address for $type when not claimed yet",
            async ({ params, asset, address }) => {
                const [swap] = createSignal<SomeSwap>(params);

                render(
                    () => (
                        <BlockExplorerLink
                            swap={swap}
                            swapStatus={() => "transaction.mempool"}
                        />
                    ),
                    { wrapper: contextWrapper },
                );

                const button = (await screen.findByText(
                    "open lockup address",
                )) as HTMLAnchorElement;

                expect(button.href).toEqual(
                    `${config.assets[asset].blockExplorerUrl.normal}/address/${address}`,
                );
            },
        );

        test.each`
            type                  | asset   | params
            ${SwapType.Submarine} | ${BTC}  | ${{ type: SwapType.Submarine, assetSend: BTC, claimTx: "123" }}
            ${SwapType.Reverse}   | ${LBTC} | ${{ type: SwapType.Reverse, assetReceive: LBTC, claimTx: "123" }}
        `(
            "should show claim transaction for $type",
            async ({ params, asset }) => {
                const [swap] = createSignal<SomeSwap>(params);

                render(
                    () => (
                        <BlockExplorerLink
                            swap={swap}
                            swapStatus={() => "transaction.claimed"}
                        />
                    ),
                    { wrapper: contextWrapper },
                );

                const button = (await screen.findByText(
                    "open claim transaction",
                )) as HTMLAnchorElement;

                expect(button.href).toEqual(
                    `${config.assets[asset].blockExplorerUrl.normal}/tx/${params.claimTx}`,
                );
            },
        );
    });

    describe("Chain Swaps", () => {
        test("should show lockup address when not claimed yet", async () => {
            const [swap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: LBTC,
                assetReceive: BTC,
                lockupDetails: {
                    lockupAddress: "bc1",
                },
            } as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                "open lockup address",
            )) as HTMLAnchorElement;

            expect(button.href).toEqual(
                // eslint-disable-next-line solid/reactivity
                `${config.assets[LBTC].blockExplorerUrl.normal}/address/${swap().lockupDetails.lockupAddress}`,
            );
        });

        test("should reactively show claim transaction", async () => {
            const [swap, setSwap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: LBTC,
                assetReceive: BTC,
                lockupDetails: {
                    lockupAddress: "bc1",
                },
            } as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                "open lockup address",
            )) as HTMLAnchorElement;

            expect(button.href).toEqual(
                // eslint-disable-next-line solid/reactivity
                `${config.assets[LBTC].blockExplorerUrl.normal}/address/${swap().lockupDetails.lockupAddress}`,
            );

            // eslint-disable-next-line solid/reactivity
            setSwap({ ...swap(), claimTx: "123" });

            expect(button.href).toEqual(
                // eslint-disable-next-line solid/reactivity
                `${config.assets[BTC].blockExplorerUrl.normal}/tx/${swap().claimTx}`,
            );
        });
    });
});
