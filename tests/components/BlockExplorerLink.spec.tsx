import { render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import BlockExplorerLink from "../../src/components/BlockExplorerLink";
import { config } from "../../src/config";
import { BTC, LBTC, RBTC, TBTC, USDC, USDT0 } from "../../src/consts/Assets";
import { SwapPosition, SwapType } from "../../src/consts/Enums";
import dict from "../../src/i18n/i18n";
import type { ChainSwap, SomeSwap } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

describe("BlockExplorerLink", () => {
    const blockExplorerLabel = (typeLabel: string) =>
        dict.en.blockexplorer.replace("{{ typeLabel }}", typeLabel);
    const lockupAddressLabel = blockExplorerLabel(
        dict.en.blockexplorer_lockup_address,
    );
    const lockupTransactionLabel = blockExplorerLabel(
        dict.en.blockexplorer_lockup_tx,
    );
    const claimTransactionLabel = blockExplorerLabel(
        dict.en.blockexplorer_claim_tx,
    );
    const bridgeStatusLabel = dict.en.check_bridge_status;

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
                    lockupAddressLabel,
                )) as HTMLAnchorElement;

                expect(button.href).toEqual(
                    `${config.assets![asset].blockExplorerUrl!.normal}/address/${address}`,
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
                    claimTransactionLabel,
                )) as HTMLAnchorElement;

                expect(button.href).toEqual(
                    `${config.assets![asset].blockExplorerUrl!.normal}/tx/${params.claimTx}`,
                );
            },
        );

        test("should show LayerZero bridge status for OFT swaps", async () => {
            const claimTx = "123";
            const [swap] = createSignal<SomeSwap>({
                type: SwapType.Reverse,
                assetReceive: USDT0,
                claimTx,
                bridge: {
                    kind: "oft",
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    position: SwapPosition.Post,
                },
            } as unknown as SomeSwap);

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
                bridgeStatusLabel,
            )) as HTMLAnchorElement;

            expect(screen.queryByText(claimTransactionLabel)).toBeNull();
            expect(button.href).toEqual(
                `${config.layerZeroExplorerUrl}/tx/${claimTx}`,
            );
        });

        test("should show CCTP bridge status for CCTP swaps", async () => {
            const claimTx =
                "0x3ca4451e3008d523eec1c64e617663894e47cabd335654bd9f65724772682de8";
            const [swap] = createSignal<SomeSwap>({
                type: SwapType.Reverse,
                assetReceive: USDC,
                claimTx,
                bridge: {
                    kind: "cctp",
                    sourceAsset: USDC,
                    destinationAsset: "USDC-BASE",
                    position: SwapPosition.Post,
                },
            } as unknown as SomeSwap);

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
                bridgeStatusLabel,
            )) as HTMLAnchorElement;

            expect(screen.queryByText(claimTransactionLabel)).toBeNull();
            expect(button.href).toEqual(
                `${config.cctpExplorerUrl}/messages?transactionHash=${claimTx}`,
            );
        });
    });

    describe("Chain Swaps", () => {
        const evmSendAssets = [RBTC, TBTC, USDT0] as const;

        test("should show lockup address when not claimed yet", async () => {
            const [swap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: LBTC,
                assetReceive: BTC,
                lockupDetails: {
                    lockupAddress: "bc1",
                },
            } as unknown as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                lockupAddressLabel,
            )) as HTMLAnchorElement;

            expect(button.href).toEqual(
                // eslint-disable-next-line solid/reactivity
                `${config.assets![LBTC].blockExplorerUrl!.normal}/address/${swap().lockupDetails.lockupAddress}`,
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
                lockupAddressLabel,
            )) as HTMLAnchorElement;

            expect(button.href).toEqual(
                // eslint-disable-next-line solid/reactivity
                `${config.assets![LBTC].blockExplorerUrl!.normal}/address/${swap().lockupDetails.lockupAddress}`,
            );

            // eslint-disable-next-line solid/reactivity
            setSwap({ ...swap(), claimTx: "123" });

            expect(button.href).toEqual(
                // eslint-disable-next-line solid/reactivity
                `${config.assets![BTC].blockExplorerUrl!.normal}/tx/${swap().claimTx}`,
            );
        });

        test.each(evmSendAssets)(
            "should not show lockup address when sending from %s without lockup transaction",
            (assetSend) => {
                const [swap] = createSignal<ChainSwap>({
                    type: SwapType.Chain,
                    assetSend,
                    assetReceive: BTC,
                    lockupDetails: {
                        lockupAddress: "0xabc",
                    },
                } as unknown as ChainSwap);

                render(
                    () => (
                        <BlockExplorerLink swap={swap} swapStatus={() => ""} />
                    ),
                    { wrapper: contextWrapper },
                );

                expect(screen.queryByText(lockupAddressLabel)).toBeNull();
                expect(screen.queryByText(lockupTransactionLabel)).toBeNull();
            },
        );

        test.each(evmSendAssets)(
            "should show lockup transaction (not address) when sending from %s",
            async (assetSend) => {
                const lockupTx = "0xdeadbeef";
                const [swap] = createSignal<ChainSwap>({
                    type: SwapType.Chain,
                    assetSend,
                    assetReceive: BTC,
                    lockupTx,
                    lockupDetails: {
                        lockupAddress: "0xabc",
                    },
                } as unknown as ChainSwap);

                render(
                    () => (
                        <BlockExplorerLink swap={swap} swapStatus={() => ""} />
                    ),
                    { wrapper: contextWrapper },
                );

                expect(screen.queryByText(lockupAddressLabel)).toBeNull();

                const button = (await screen.findByText(
                    lockupTransactionLabel,
                )) as HTMLAnchorElement;

                expect(button.href).toEqual(
                    `${config.assets![assetSend].blockExplorerUrl!.normal}/tx/${lockupTx}`,
                );
            },
        );

        test("should route EVM lockup transaction to asset explorer, not LayerZero, for OFT chain swaps", async () => {
            const lockupTx = "0xdeadbeef";
            const [swap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: RBTC,
                assetReceive: USDT0,
                lockupTx,
                bridge: {
                    kind: "oft",
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    position: SwapPosition.Post,
                },
                lockupDetails: {
                    lockupAddress: "0xabc",
                },
            } as unknown as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                lockupTransactionLabel,
            )) as HTMLAnchorElement;

            expect(button.href).toEqual(
                `${config.assets![RBTC].blockExplorerUrl!.normal}/tx/${lockupTx}`,
            );
        });

        test("should still show claim transaction after claim when sending from EVM chain", async () => {
            const claimTx = "0xclaim";
            const [swap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: RBTC,
                assetReceive: BTC,
                claimTx,
                lockupTx: "0xdeadbeef",
                lockupDetails: {
                    lockupAddress: "0xabc",
                },
            } as unknown as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                claimTransactionLabel,
            )) as HTMLAnchorElement;

            expect(button.href).toEqual(
                `${config.assets![BTC].blockExplorerUrl!.normal}/tx/${claimTx}`,
            );
        });

        test("should show LayerZero bridge status for OFT chain swaps", async () => {
            const claimTx = "123";
            const [swap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: LBTC,
                assetReceive: USDT0,
                claimTx,
                bridge: {
                    kind: "oft",
                    sourceAsset: USDT0,
                    destinationAsset: "USDT0-ETH",
                    position: SwapPosition.Post,
                },
                lockupDetails: {
                    lockupAddress: "bc1",
                },
            } as unknown as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                bridgeStatusLabel,
            )) as HTMLAnchorElement;

            expect(screen.queryByText(claimTransactionLabel)).toBeNull();
            expect(button.href).toEqual(
                `${config.layerZeroExplorerUrl}/tx/${claimTx}`,
            );
        });

        test("should show CCTP bridge status for CCTP chain swaps", async () => {
            const claimTx =
                "0x3ca4451e3008d523eec1c64e617663894e47cabd335654bd9f65724772682de8";
            const [swap] = createSignal<ChainSwap>({
                type: SwapType.Chain,
                assetSend: LBTC,
                assetReceive: USDC,
                claimTx,
                bridge: {
                    kind: "cctp",
                    sourceAsset: USDC,
                    destinationAsset: "USDC-BASE",
                    position: SwapPosition.Post,
                },
                lockupDetails: {
                    lockupAddress: "bc1",
                },
            } as unknown as ChainSwap);

            render(
                () => <BlockExplorerLink swap={swap} swapStatus={() => ""} />,
                { wrapper: contextWrapper },
            );

            const button = (await screen.findByText(
                bridgeStatusLabel,
            )) as HTMLAnchorElement;

            expect(screen.queryByText(claimTransactionLabel)).toBeNull();
            expect(button.href).toEqual(
                `${config.cctpExplorerUrl}/messages?transactionHash=${claimTx}`,
            );
        });
    });
});
