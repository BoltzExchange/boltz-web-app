import type * as SolidRouter from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    swapStatusFailed,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import Pay from "../../src/pages/Pay";
import { getSwapStatus } from "../../src/utils/boltzClient";
import type { ChainSwap, ReverseSwap } from "../../src/utils/swapCreator";
import { TestComponent } from "../helper";
import { contextWrapper, payContext } from "../helper";

vi.mock("../../src/utils/boltzClient", () => ({
    getSwapStatus: vi.fn(),
}));
const mockGetSwapStatus = vi.mocked(getSwapStatus);
mockGetSwapStatus.mockResolvedValue({
    status: swapStatusFailed.TransactionRefunded,
});

vi.mock("localforage", () => ({
    default: {
        config: vi.fn(),
        createInstance: vi.fn(() => ({
            getItem: vi.fn().mockResolvedValue({
                id: "123",
                type: SwapType.Chain,
                assetReceive: BTC,
                assetSend: LBTC,
                lockupDetails: {},
            }),
            iterate: vi.fn(),
        })),
    },
}));

const mockUseLocation = vi.mocked(useLocation);
mockUseLocation.mockReturnValue({
    hash: "",
    key: "",
    pathname: "",
    search: "",
    state: undefined,
} as unknown as ReturnType<typeof useLocation>);

vi.mock("@solidjs/router", async () => {
    const actual = await vi.importActual<typeof SolidRouter>("@solidjs/router");
    return {
        ...actual,
        useParams: vi.fn(() => ({ id: "123" })), // Mock params.id
        useLocation: vi.fn(() => ({ state: undefined })),
    };
});

describe("Pay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

    test("should set status to swap.waitingForRefund when timedOutRefundable is true", async () => {
        mockUseLocation.mockReturnValue({
            ...mockUseLocation(),
            state: { timedOutRefundable: true },
        } as ReturnType<typeof useLocation>);

        mockGetSwapStatus.mockResolvedValue({
            status: swapStatusSuccess.TransactionClaimed, // Frontend should ignore this status when timedOutRefundable is true
        });

        render(
            () => (
                <>
                    <TestComponent />
                    <Pay />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const status = await screen.findByText("swap.waitingForRefund");
        expect(status).toBeVisible();
    });
});
