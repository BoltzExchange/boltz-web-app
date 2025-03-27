import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import { swapStatusFailed } from "../../src/consts/SwapStatus";
import Pay from "../../src/pages/Pay";
import { ChainSwap, ReverseSwap } from "../../src/utils/swapCreator";
import { TestComponent } from "../helper";
import { contextWrapper, payContext } from "../helper";

vi.mock("../../src/utils/boltzClient", () => ({
    getSwapStatus: vi.fn().mockResolvedValue({
        status: swapStatusFailed.TransactionRefunded,
    }),
}));

vi.mock("@solidjs/router", async () => {
    const actual =
        await vi.importActual<typeof import("@solidjs/router")>(
            "@solidjs/router",
        );
    return {
        ...actual,
        useParams: vi.fn(() => ({ id: "123" })), // Mock params.id
    };
});

describe("Pay", () => {
    test("should rename `transaction.refunded` to `swap.waitingForRefund` on ChainSwap", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Pay />
                </>
            ),
            { wrapper: contextWrapper },
        );
        payContext.setSwap({
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: {},
        } as ChainSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const status = await screen.findByText("swap.waitingForRefund");
        expect(status).not.toBeUndefined();
    });

    test("should allow to refund `transaction.refunded` on ChainSwap", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Pay />
                </>
            ),
            { wrapper: contextWrapper },
        );
        payContext.setSwap({
            type: SwapType.Chain,
            assetReceive: BTC,
            assetSend: LBTC,
            lockupDetails: {},
        } as ChainSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const button = (await screen.findByTestId(
            "refundButton",
        )) as HTMLButtonElement;
        expect(button).toBeTruthy();
    });

    test("should not rename `transaction.refunded` status on ReverseSwap", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Pay />
                </>
            ),
            { wrapper: contextWrapper },
        );
        payContext.setSwap({
            type: SwapType.Reverse,
            assetReceive: LBTC,
            assetSend: BTC,
            lockupDetails: {},
        } as unknown as ReverseSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const status = await screen.findByText("transaction.refunded");
        expect(status).not.toBeUndefined();
    });

    test("should not allow to refund `transaction.refunded` on ReverseSwap", () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Pay />
                </>
            ),
            { wrapper: contextWrapper },
        );
        payContext.setSwap({
            type: SwapType.Reverse,
            assetReceive: LBTC,
            assetSend: BTC,
            lockupDetails: {},
        } as unknown as ReverseSwap);
        payContext.setSwapStatus(swapStatusFailed.TransactionRefunded);

        const button = screen.queryByTestId(
            "refundButton",
        ) as HTMLButtonElement;
        expect(button).not.toBeTruthy();
    });
});
