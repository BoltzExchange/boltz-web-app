import { render, screen } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";
import { createSignal } from "solid-js";

import { BTC, RBTC } from "../../src/consts/Assets";
import { swapStatusFailed } from "../../src/consts/SwapStatus";
import i18n from "../../src/i18n/i18n";
import TransactionLockupFailed from "../../src/status/TransactionLockupFailed";
import type { SomeSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper, payContext } from "../helper";

describe("TransactionLockupFailed", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test.each([OutputType.Bech32, OutputType.Compatibility, undefined])(
        "should show timeout for legacy swaps",
        async (type) => {
            // eslint-disable-next-line solid/reactivity
            const [, setStatusOverride] = createSignal<string>();

            render(
                () => (
                    <>
                        <TestComponent />
                        <TransactionLockupFailed
                            setStatusOverride={setStatusOverride}
                        />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            payContext.setFailureReason(
                "You will be able to refund after the timeout",
            );
            payContext.setSwap({
                assetReceive: BTC,
                version: type,
            } as SomeSwap);

            await expect(
                screen.findByText((content) =>
                    content.includes(i18n.en.refund_explainer),
                ),
            ).resolves.not.toBeUndefined();
        },
    );

    test("should show refund button for Taproot swaps", async () => {
        // eslint-disable-next-line solid/reactivity
        const [, setStatusOverride] = createSignal<string>();

        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionLockupFailed
                        setStatusOverride={setStatusOverride}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({
            assetReceive: BTC,
            version: OutputType.Taproot,
        } as SomeSwap);
        payContext.setRefundableUTXOs([{ hex: "0x0" }]);

        await expect(
            screen.findByText(i18n.en.refund),
        ).resolves.not.toBeUndefined();
    });

    test("should show refund button for RBTC swaps", async () => {
        // eslint-disable-next-line solid/reactivity
        const [, setStatusOverride] = createSignal<string>();

        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionLockupFailed
                        setStatusOverride={setStatusOverride}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({ assetReceive: RBTC } as SomeSwap);
        payContext.setRefundableUTXOs([{ hex: "0x0" }]);

        await expect(
            screen.findByText(i18n.en.refund),
        ).resolves.not.toBeUndefined();
    });

    test.each(Object.values(swapStatusFailed))(
        "should show refund button for failed swap with any UTXO",
        async (status) => {
            // eslint-disable-next-line solid/reactivity
            const [, setStatusOverride] = createSignal<string>();

            render(
                () => (
                    <>
                        <TestComponent />
                        <TransactionLockupFailed
                            setStatusOverride={setStatusOverride}
                        />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            payContext.setRefundableUTXOs([
                {
                    hex: "0x",
                    timeoutEta: null,
                    timeoutBlockHeight: null,
                },
            ]);
            payContext.setSwap({
                assetReceive: BTC,
                version: OutputType.Taproot,
                status: status,
            } as SomeSwap);

            await expect(
                screen.findByText(i18n.en.refund),
            ).resolves.not.toBeUndefined();
        },
    );

    test("should not show refund button for swap with no UTXO", async () => {
        // eslint-disable-next-line solid/reactivity
        const [, setStatusOverride] = createSignal<string>();

        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionLockupFailed
                        setStatusOverride={setStatusOverride}
                    />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({
            assetReceive: BTC,
            version: OutputType.Taproot,
            status: swapStatusFailed.SwapExpired,
        } as SomeSwap);

        await expect(
            screen.findByText(i18n.en.no_lockup_transaction),
        ).resolves.not.toBeUndefined();
    });
});
