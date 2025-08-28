import { type Mock, beforeEach, vi } from "vitest";

import { BTC, LBTC, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import {
    swapStatusFailed,
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import {
    RescueAction,
    createRescueList,
    isSwapClaimable,
} from "../../src/utils/rescue";
import type {
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "../../src/utils/swapCreator";

const blockchainModule = await import("../../src/utils/blockchain");
const boltzClientModule = await import("../../src/utils/boltzClient");

type RescueListResult = (SomeSwap & {
    action: RescueAction;
    timedOut?: boolean;
})[];

vi.mock("../../src/utils/blockchain", () => ({
    getBlockTipHeight: vi.fn(),
    getSwapUTXOs: vi.fn(),
}));

vi.mock("../../src/utils/boltzClient", () => ({
    getLockupTransaction: vi.fn(),
}));

vi.mock("../../src/utils/fees", () => ({
    getFeeEstimationsFailover: vi.fn(),
}));

vi.mock("loglevel", () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("rescue", () => {
    describe("isSwapClaimable", () => {
        test.each([
            {
                name: "Reverse: confirmed -> true",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Reverse: mempool -> true",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionMempool,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Reverse: success not included by default -> false",
                type: SwapType.Reverse,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Reverse: irrelevant status -> false",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Reverse: include success -> true",
                type: SwapType.Reverse,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: true,
                expected: true,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(isSwapClaimable({ status, type, includeSuccess })).toEqual(
                expected,
            );
        });

        test.each([
            {
                name: "Chain: server confirmed -> true",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerConfirmed,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Chain: server mempool -> true",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: undefined,
                expected: true,
            },
            {
                name: "Chain: success not included by default -> false",
                type: SwapType.Chain,
                status: swapStatusSuccess.TransactionClaimed,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Chain: include success -> true",
                type: SwapType.Chain,
                status: swapStatusSuccess.TransactionClaimed,
                includeSuccess: true,
                expected: true,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(isSwapClaimable({ status, type, includeSuccess })).toEqual(
                expected,
            );
        });

        test.each([
            {
                name: "Submarine: confirmed -> false",
                type: SwapType.Submarine,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Submarine: success (includeSuccess=true) -> false",
                type: SwapType.Submarine,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: true,
                expected: false,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(isSwapClaimable({ status, type, includeSuccess })).toEqual(
                expected,
            );
        });

        test.each([
            { type: SwapType.Chain, includeSuccess: undefined },
            { type: SwapType.Chain, includeSuccess: false },
            { type: SwapType.Chain, includeSuccess: true },
            { type: SwapType.Reverse, includeSuccess: undefined },
            { type: SwapType.Reverse, includeSuccess: false },
            { type: SwapType.Reverse, includeSuccess: true },
            { type: SwapType.Submarine, includeSuccess: undefined },
            { type: SwapType.Submarine, includeSuccess: false },
            { type: SwapType.Submarine, includeSuccess: true },
        ])(
            "should return false for unknown statuses (type: $type, includeSuccess: $includeSuccess)",
            ({ type, includeSuccess }) => {
                expect(
                    isSwapClaimable({
                        status: "unknown.status",
                        type,
                        includeSuccess,
                    }),
                ).toEqual(false);
            },
        );
    });

    describe("createRescueList", () => {
        let mockGetBlockTipHeight: Mock;
        let mockGetSwapUTXOs: Mock;
        let mockGetLockupTransaction: Mock;

        beforeEach(() => {
            vi.clearAllMocks();
            vi.resetAllMocks();

            mockGetBlockTipHeight = vi.mocked(
                blockchainModule.getBlockTipHeight,
            );
            mockGetBlockTipHeight.mockResolvedValue(1000);
            mockGetSwapUTXOs = vi.mocked(blockchainModule.getSwapUTXOs);
            mockGetLockupTransaction = vi.mocked(
                boltzClientModule.getLockupTransaction,
            );
        });

        const createMockReverseSwap = (
            overrides: Partial<ReverseSwap> = {},
        ): ReverseSwap =>
            ({
                type: SwapType.Reverse,
                ...overrides,
            }) as ReverseSwap;

        const createMockSubmarineSwap = (
            overrides: Partial<SubmarineSwap> = {},
        ): SubmarineSwap =>
            ({
                type: SwapType.Submarine,
                invoice: "test-invoice",
                ...overrides,
            }) as SubmarineSwap;

        test("should return empty array for empty swaps array", async () => {
            const result = await createRescueList([]);
            expect(result).toEqual([]);
        });

        test("should return None action for final status swaps without UTXOs", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    status: swapStatusSuccess.TransactionClaimed,
                }),
            ];

            const result = await createRescueList(swaps);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.None);
        });

        test("should handle multiple swaps with different actions", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    id: "swap-1",
                    status: swapStatusPending.TransactionConfirmed,
                    timeoutBlockHeight: 900,
                    assetSend: BTC,
                }),
                createMockReverseSwap({
                    id: "swap-2",
                    status: swapStatusPending.TransactionConfirmed,
                    assetSend: BTC,
                }),
                createMockSubmarineSwap({
                    id: "swap-3",
                    status: swapStatusFinal[0],
                    assetSend: LBTC,
                }),
                createMockReverseSwap({
                    id: "swap-4",
                    status: swapStatusPending.SwapCreated,
                    assetSend: LBTC,
                }),
            ];

            mockGetSwapUTXOs
                .mockResolvedValueOnce([{ hex: "mock-tx-1" }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = (await createRescueList(swaps)) as RescueListResult;
            expect(result).toHaveLength(4);

            expect(result[0].action).toBe(RescueAction.Refund);
            expect(result[0].timedOut).toBe(true);
            expect(result[1].action).toBe(RescueAction.Claim);
            expect(result[2].action).toBe(RescueAction.None);
            expect(result[3].action).toBe(RescueAction.Pending);
        });

        test("should prioritize refund for expired swaps over other actions", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    status: swapStatusPending.TransactionConfirmed,
                    timeoutBlockHeight: 900,
                    assetSend: BTC,
                }),
            ];

            mockGetSwapUTXOs.mockResolvedValue([{ hex: "mock-tx" }]);

            const result = (await createRescueList(swaps)) as RescueListResult;
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.Refund);
            expect(result[0].timedOut).toBe(true);
        });

        test("should not show RBTC as Refundable", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    status: swapStatusPending.TransactionConfirmed,
                    timeoutBlockHeight: 900,
                    assetSend: RBTC,
                }),
            ];

            const result = await createRescueList(swaps);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.Pending);
        });

        test.each([
            {
                status: swapStatusSuccess.TransactionClaimed,
                action: RescueAction.None,
                createSwap: createMockSubmarineSwap,
            },
            {
                status: swapStatusSuccess.InvoiceSettled,
                action: RescueAction.None,
                createSwap: createMockSubmarineSwap,
            },
            ...Object.values(swapStatusPending).map((status) => ({
                status,
                action: RescueAction.Pending,
                createSwap: createMockSubmarineSwap,
            })),
            {
                status: swapStatusPending.TransactionConfirmed,
                action: RescueAction.Claim,
                createSwap: createMockReverseSwap,
            },
            {
                status: swapStatusFailed.TransactionFailed,
                action: RescueAction.Refund,
                createSwap: createMockSubmarineSwap,
            },
        ])(
            "3rd party explorer down: should return $action for $status swaps",
            async ({ status, action, createSwap }) => {
                const swaps = [
                    createSwap({
                        status,
                    }),
                ];

                mockGetSwapUTXOs.mockRejectedValue(new Error("UTXO error"));
                mockGetLockupTransaction.mockResolvedValue({
                    hex: "lockup-tx-hex",
                });

                const result = await createRescueList(swaps);
                expect(result).toHaveLength(1);
                expect(result[0].action).toBe(action);
            },
        );
    });
});
