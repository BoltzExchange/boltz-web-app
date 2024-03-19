import { render, screen } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";

import { BTC, RBTC } from "../../src/consts";
import i18n from "../../src/i18n/i18n";
import TransactionLockupFailed from "../../src/status/TransactionLockupFailed";
import { TestComponent, contextWrapper, payContext } from "../helper";

describe("TransactionLockupFailed", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([OutputType.Bech32, OutputType.Compatibility, undefined])(
        "should show timeout for legacy swaps",
        async (type) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <TransactionLockupFailed />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            payContext.setTimeoutEta(1);
            payContext.setSwap({ asset: BTC, version: type });

            await expect(
                screen.findByText(i18n.en.refund_explainer),
            ).resolves.not.toBeUndefined();
        },
    );

    test("should show refund button for Taproot swaps", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionLockupFailed />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({ asset: BTC, version: OutputType.Taproot });

        await expect(
            screen.findByText(i18n.en.refund),
        ).resolves.not.toBeUndefined();
    });

    test("should show refund button for RBTC swaps", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionLockupFailed />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({ asset: RBTC });

        await expect(
            screen.findByText(i18n.en.refund),
        ).resolves.not.toBeUndefined();
    });
});
