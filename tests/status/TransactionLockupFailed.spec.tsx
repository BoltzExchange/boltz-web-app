import { render, screen } from "@solidjs/testing-library";
import { OutputType } from "boltz-core";

import { BTC, LBTC, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import TransactionLockupFailed from "../../src/status/TransactionLockupFailed";
import { TestComponent, contextWrapper, payContext } from "../helper";

jest.mock("../../src/utils/boltzClient", () => {
    const originalModule = jest.requireActual("../../src/utils/boltzClient");
    return {
        __esModule: true,
        ...originalModule,
        getLockupTransaction: jest.fn(() => {
            return { timeoutBlockHeight: 10, timeoutEta: 10 };
        }),
    };
});

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
            payContext.setSwap({ assetReceive: BTC, version: type } as any);

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
        payContext.setSwap({
            assetReceive: BTC,
            version: OutputType.Taproot,
        } as any);

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
        payContext.setSwap({ assetReceive: RBTC } as any);

        await expect(
            screen.findByText(i18n.en.refund),
        ).resolves.not.toBeUndefined();
    });

    test.each`
        swap
        ${{ assetSend: BTC, type: SwapType.Submarine, address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" }}
        ${{ assetSend: LBTC, type: SwapType.Chain, lockupDetails: { lockupAddress: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" } }}
    `("should show blockexplorer lockup address button", async ({ swap }) => {
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
        const lockup_address =
            swap.type === SwapType.Submarine
                ? swap.address
                : swap.lockupDetails.lockupAddress;
        payContext.setSwap(swap);

        const type_label = i18n.en.blockexplorer_lockup_address;
        const label = i18n.en.blockexplorer.replace(
            "{{ typeLabel }}",
            type_label,
        );
        const button = screen.getByText(label);
        expect(button).not.toBeUndefined();
        expect(button.getAttribute("href")).toMatch(lockup_address);
    });
});
