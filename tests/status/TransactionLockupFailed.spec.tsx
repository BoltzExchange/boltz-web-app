import { render, screen } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";
import { createSignal } from "solid-js";

import { BTC, RBTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import TransactionLockupFailed from "../../src/status/TransactionLockupFailed";
import { SomeSwap } from "../../src/utils/swapCreator";
import { TestComponent, contextWrapper, payContext } from "../helper";

vi.mock("../../src/utils/boltzClient", () => {
    return {
        getLockupTransaction: vi.fn(() => {
            return { timeoutBlockHeight: 10, timeoutEta: 10 };
        }),
    };
});

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
            payContext.setSwap({
                assetReceive: BTC,
                version: type,
            } as SomeSwap);

            await expect(
                screen.findByText(i18n.en.refund_explainer),
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

        await expect(
            screen.findByText(i18n.en.refund),
        ).resolves.not.toBeUndefined();
    });
});
