import type * as SolidRouter from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    swapStatusFailed,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import Pay from "../../src/pages/Pay";
import {
    getLockupTransaction,
    getSwapStatus,
} from "../../src/utils/boltzClient";
import { getRefundableUTXOs } from "../../src/utils/rescue";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
} from "../../src/utils/swapCreator";
import { TestComponent } from "../helper";
import { contextWrapper, payContext } from "../helper";

vi.mock("../../src/utils/boltzClient", () => ({
    getSwapStatus: vi.fn(),
    getLockupTransaction: vi.fn(),
}));
vi.mock("../../src/utils/rescue", () => ({
    getRefundableUTXOs: vi.fn(),
}));
const mockGetSwapStatus = vi.mocked(getSwapStatus);
mockGetSwapStatus.mockResolvedValue({
    status: swapStatusFailed.TransactionRefunded,
});
const mockGetRefundableUTXOs = vi.mocked(getRefundableUTXOs);
const mockGetLockupTransaction = vi.mocked(getLockupTransaction);

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

    test.each([
        {
            swapType: SwapType.Submarine,
            assetReceive: LN,
            assetSend: BTC,
        },
        {
            swapType: SwapType.Chain,
            assetReceive: LBTC,
            assetSend: BTC,
        },
    ])(
        "should not attempt to fetch UTXOs for $swapType swap during initial phase",
        ({ swapType, assetReceive, assetSend }) => {
            mockGetSwapStatus.mockResolvedValue({
                status: swapStatusPending.SwapCreated,
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
            payContext.setSwap({
                type: swapType,
                assetReceive,
                assetSend,
                lockupDetails: {},
                invoice:
                    swapType === SwapType.Submarine ? "invoice" : undefined,
            } as unknown as SomeSwap);

            // Check for all possible values of prevSwapStatus
            const prevSwapStatuses = ["", null, undefined];
            for (const prevSwapStatus of prevSwapStatuses) {
                payContext.setSwapStatus(prevSwapStatus);
                payContext.setSwapStatus(swapStatusPending.SwapCreated);
            }

            expect(mockGetRefundableUTXOs).not.toHaveBeenCalled();
            expect(mockGetLockupTransaction).not.toHaveBeenCalled();
        },
    );
});
