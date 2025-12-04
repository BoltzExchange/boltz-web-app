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

const zeroConf = true;

describe("rescue", () => {
    describe("isSwapClaimable", () => {
        test.each([
            {
                name: "Reverse: confirmed",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: undefined,
                zeroConf: true,
                expected: true,
            },
            {
                name: "Reverse: mempool",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionMempool,
                includeSuccess: undefined,
                zeroConf: true,
                expected: true,
            },
            {
                name: "Reverse: success not included by default",
                type: SwapType.Reverse,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: undefined,
                zeroConf: true,
                expected: false,
            },
            {
                name: "Reverse: irrelevant status",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: undefined,
                zeroConf: true,
                expected: false,
            },
            {
                name: "Reverse: include success",
                type: SwapType.Reverse,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: true,
                zeroConf: true,
                expected: true,
            },
            {
                name: "Reverse: don't claim on TransactionMempool with zeroConf disabled",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionMempool,
                includeSuccess: true,
                zeroConf: false,
                expected: false,
            },
            {
                name: "Reverse: claim on TransactionConfirmed with zeroConf disabled",
                type: SwapType.Reverse,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: true,
                zeroConf: false,
                expected: true,
            },
        ])("$name", ({ type, status, includeSuccess, zeroConf, expected }) => {
            expect(
                isSwapClaimable({ status, type, includeSuccess, zeroConf }),
            ).toEqual(expected);
        });

        test.each([
            {
                name: "Chain: server confirmed",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerConfirmed,
                includeSuccess: undefined,
                zeroConf: true,
                expected: true,
            },
            {
                name: "Chain: server mempool",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: undefined,
                zeroConf: true,
                expected: true,
            },
            {
                name: "Chain: success not included by default",
                type: SwapType.Chain,
                status: swapStatusSuccess.TransactionClaimed,
                includeSuccess: undefined,
                zeroConf: true,
                expected: false,
            },
            {
                name: "Chain: include success",
                type: SwapType.Chain,
                status: swapStatusSuccess.TransactionClaimed,
                includeSuccess: true,
                zeroConf: true,
                expected: true,
            },
            {
                name: "Chain: don't claim on TransactionServerMempool with zeroConf disabled",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerMempool,
                includeSuccess: true,
                zeroConf: false,
                expected: false,
            },
            {
                name: "Chain: claim on TransactionServerConfirmed with zeroConf disabled",
                type: SwapType.Chain,
                status: swapStatusPending.TransactionServerConfirmed,
                includeSuccess: true,
                zeroConf: false,
                expected: true,
            },
        ])("$name", ({ type, status, includeSuccess, zeroConf, expected }) => {
            expect(
                isSwapClaimable({ status, type, includeSuccess, zeroConf }),
            ).toEqual(expected);
        });

        test.each([
            {
                name: "Submarine: confirmed",
                type: SwapType.Submarine,
                status: swapStatusPending.TransactionConfirmed,
                includeSuccess: undefined,
                expected: false,
            },
            {
                name: "Submarine: success (includeSuccess=true)",
                type: SwapType.Submarine,
                status: swapStatusSuccess.InvoiceSettled,
                includeSuccess: true,
                expected: false,
            },
        ])("$name", ({ type, status, includeSuccess, expected }) => {
            expect(
                isSwapClaimable({
                    status,
                    type,
                    includeSuccess,
                    zeroConf: true,
                }),
            ).toEqual(expected);
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
                        zeroConf: true,
                    }),
                ).toEqual(false);
            },
        );

        describe("backup import timestamp behavior", () => {
            const backupImportTime = 1000000;
            const beforeBackup = backupImportTime - 1000;
            const afterBackup = backupImportTime + 1000;
            const sameAsBackup = backupImportTime;

            test.each([
                {
                    name: "Reverse: should not auto-claim successful swap created before backup",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    swapDate: beforeBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: false,
                },
                {
                    name: "Reverse: should auto-claim successful swap created after backup",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    swapDate: afterBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: true,
                },
                {
                    name: "Reverse: should auto-claim swap created at exact same time as backup",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    swapDate: sameAsBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: true,
                },
                {
                    name: "Chain: should not auto-claim successful swap created before backup",
                    type: SwapType.Chain,
                    status: swapStatusSuccess.TransactionClaimed,
                    swapDate: beforeBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: false,
                },
                {
                    name: "Chain: should auto-claim successful swap created after backup",
                    type: SwapType.Chain,
                    status: swapStatusSuccess.TransactionClaimed,
                    swapDate: afterBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: true,
                },
                {
                    name: "Chain: should auto-claim swap created at exact same time as backup",
                    type: SwapType.Chain,
                    status: swapStatusSuccess.TransactionClaimed,
                    swapDate: sameAsBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: true,
                },
            ])(
                "$name",
                ({
                    type,
                    status,
                    swapDate,
                    backupImportTimestamp,
                    expected,
                }) => {
                    expect(
                        isSwapClaimable({
                            status,
                            type,
                            includeSuccess: true,
                            swapDate,
                            backupImportTimestamp,
                            zeroConf: false,
                        }),
                    ).toBe(expected);
                },
            );

            test.each([
                {
                    name: "Reverse: should still claim pending swaps even if created before backup",
                    type: SwapType.Reverse,
                    status: swapStatusPending.TransactionConfirmed,
                    swapDate: beforeBackup,
                    expected: true,
                },
                {
                    name: "Chain: should still claim pending swaps even if created before backup",
                    type: SwapType.Chain,
                    status: swapStatusPending.TransactionServerMempool,
                    swapDate: beforeBackup,
                    expected: true,
                },
            ])("$name", ({ type, status, swapDate, expected }) => {
                expect(
                    isSwapClaimable({
                        status,
                        type,
                        includeSuccess: false,
                        swapDate,
                        backupImportTimestamp: backupImportTime,
                        zeroConf: true,
                    }),
                ).toBe(expected);
            });

            test.each([
                {
                    name: "Reverse: should NOT auto-claim with undefined swapDate",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    swapDate: undefined,
                    backupImportTimestamp: backupImportTime,
                    expected: false,
                },
                {
                    name: "Reverse: should auto-claim with undefined backupImportTimestamp",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    swapDate: beforeBackup,
                    backupImportTimestamp: undefined,
                    expected: true,
                },
                {
                    name: "Reverse: should auto-claim when both timestamps are undefined",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    swapDate: undefined,
                    backupImportTimestamp: undefined,
                    expected: true,
                },
                {
                    name: "Chain: should NOT auto-claim with undefined swapDate",
                    type: SwapType.Chain,
                    status: swapStatusSuccess.TransactionClaimed,
                    swapDate: undefined,
                    backupImportTimestamp: backupImportTime,
                    expected: false,
                },
                {
                    name: "Chain: should auto-claim with undefined backupImportTimestamp",
                    type: SwapType.Chain,
                    status: swapStatusSuccess.TransactionClaimed,
                    swapDate: beforeBackup,
                    backupImportTimestamp: undefined,
                    expected: true,
                },
            ])(
                "$name",
                ({
                    type,
                    status,
                    swapDate,
                    backupImportTimestamp,
                    expected,
                }) => {
                    expect(
                        isSwapClaimable({
                            status,
                            type,
                            includeSuccess: true,
                            swapDate,
                            backupImportTimestamp,
                            zeroConf: true,
                        }),
                    ).toBe(expected);
                },
            );

            test.each([
                {
                    name: "should not affect includeSuccess=false behavior",
                    type: SwapType.Reverse,
                    status: swapStatusSuccess.InvoiceSettled,
                    includeSuccess: false,
                    swapDate: afterBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: false,
                },
                {
                    name: "Submarine swaps should not be affected by backup timestamp",
                    type: SwapType.Submarine,
                    status: swapStatusSuccess.InvoiceSettled,
                    includeSuccess: true,
                    swapDate: afterBackup,
                    backupImportTimestamp: backupImportTime,
                    expected: false,
                },
            ])(
                "$name",
                ({
                    type,
                    status,
                    includeSuccess,
                    swapDate,
                    backupImportTimestamp,
                    expected,
                }) => {
                    expect(
                        isSwapClaimable({
                            status,
                            type,
                            includeSuccess,
                            swapDate,
                            backupImportTimestamp,
                            zeroConf: true,
                        }),
                    ).toBe(expected);
                },
            );
        });
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
            const result = await createRescueList([], zeroConf);
            expect(result).toEqual([]);
        });

        test("should return Successful action for final status swaps without UTXOs", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    status: swapStatusSuccess.TransactionClaimed,
                }),
            ];

            const result = await createRescueList(swaps, zeroConf);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.Successful);
        });

        test("should return Failed action for failed status swaps without UTXOs", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    status: swapStatusFailed.TransactionFailed,
                }),
            ];

            mockGetSwapUTXOs.mockResolvedValue([]);

            const result = await createRescueList(swaps, zeroConf);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.Failed);
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
                createMockSubmarineSwap({
                    id: "swap-5",
                    status: swapStatusSuccess.TransactionClaimed,
                    assetSend: LBTC,
                }),
            ];

            mockGetSwapUTXOs
                .mockResolvedValueOnce([{ hex: "mock-tx-1" }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = (await createRescueList(
                swaps,
                zeroConf,
            )) as RescueListResult;
            expect(result).toHaveLength(swaps.length);

            expect(result[0].action).toBe(RescueAction.Refund);
            expect(result[0].timedOut).toBe(true);
            expect(result[1].action).toBe(RescueAction.Claim);
            expect(result[2].action).toBe(RescueAction.Failed);
            expect(result[3].action).toBe(RescueAction.Pending);
            expect(result[4].action).toBe(RescueAction.Successful);
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

            const result = (await createRescueList(
                swaps,
                zeroConf,
            )) as RescueListResult;
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

            const result = await createRescueList(swaps, zeroConf);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.Pending);
        });

        test.each([
            {
                status: swapStatusSuccess.TransactionClaimed,
                action: RescueAction.Successful,
                createSwap: createMockSubmarineSwap,
            },
            {
                status: swapStatusSuccess.InvoiceSettled,
                action: RescueAction.Successful,
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

                const result = await createRescueList(swaps, zeroConf);
                expect(result).toHaveLength(1);
                expect(result[0].action).toBe(action);
            },
        );
    });
});
