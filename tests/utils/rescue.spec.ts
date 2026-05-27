import { SwapType } from "boltz-swaps/types";
import { type Mock, beforeEach, vi } from "vitest";

import { BTC, LBTC, LUSDT, RBTC } from "../../src/consts/Assets";
import {
    swapStatusFailed,
    swapStatusFinal,
    swapStatusPending,
    swapStatusSuccess,
} from "../../src/consts/SwapStatus";
import {
    RescueAction,
    checkTempWalletForUtxos,
    createRescueList,
    enrichSwapsWithTempWalletData,
    isSwapClaimable,
} from "../../src/utils/rescue";
import type { RescueFile } from "../../src/utils/rescueFile";
import {
    type ReverseSwap,
    type SideSwapDetail,
    SideSwapStatus,
    type SomeSwap,
    type SubmarineSwap,
} from "../../src/utils/swapCreator";

const blockchainModule = await import("../../src/utils/blockchain");
const boltzClientModule =
    await import("../../packages/boltz-swaps/src/client.ts");
const liquidWalletModule = await import("../../src/utils/liquidWallet");

type RescueListResult = (SomeSwap & {
    action: RescueAction;
    timedOut?: boolean;
})[];

vi.mock("../../src/utils/blockchain", () => ({
    getAddressUTXOs: vi.fn(),
    getBlockTipHeight: vi.fn(),
    getSwapUTXOs: vi.fn(),
}));

vi.mock("../../packages/boltz-swaps/src/client.ts", () => ({
    getLockupTransaction: vi.fn(),
}));

vi.mock("../../src/utils/fees", () => ({
    getFeeEstimationsFailover: vi.fn(),
}));

vi.mock("../../src/utils/liquidWallet", () => ({
    deriveTempLiquidWallet: vi.fn(),
}));

vi.mock("loglevel", () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        getLevel: vi.fn(() => 5),
        levels: { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, SILENT: 5 },
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
            mockGetBlockTipHeight.mockResolvedValue("1000");
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

        test("should allow refunding claim-pending swaps with extra UTXOs", async () => {
            const swaps = [
                createMockSubmarineSwap({
                    status: swapStatusPending.TransactionClaimPending,
                    timeoutBlockHeight: 1200,
                    assetSend: BTC,
                }),
            ];

            mockGetSwapUTXOs.mockResolvedValue([{ hex: "mock-tx" }]);

            const result = await createRescueList(swaps, zeroConf);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe(RescueAction.Refund);
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
            ...Object.values(swapStatusPending)
                .filter(
                    (status) =>
                        status !== swapStatusPending.TransactionClaimPending,
                )
                .map((status) => ({
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
                status: swapStatusPending.TransactionClaimPending,
                action: RescueAction.Refund,
                createSwap: createMockSubmarineSwap,
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

    describe("SideSwap temp Liquid wallet rescue", () => {
        const rescueFile = {
            mnemonic:
                "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        } as RescueFile;

        let mockGetAddressUTXOs: Mock;
        let mockDeriveTempLiquidWallet: Mock;

        beforeEach(() => {
            vi.clearAllMocks();
            vi.resetAllMocks();

            mockGetAddressUTXOs = vi.mocked(blockchainModule.getAddressUTXOs);
            vi.mocked(blockchainModule.getBlockTipHeight).mockResolvedValue(
                "1000",
            );
            vi.mocked(blockchainModule.getSwapUTXOs).mockResolvedValue([]);
            mockDeriveTempLiquidWallet = vi.mocked(
                liquidWalletModule.deriveTempLiquidWallet,
            );
            mockDeriveTempLiquidWallet.mockImplementation(
                (_rescueFile: RescueFile, keyIndex: number) => ({
                    address: `el1qtempwallet${keyIndex}`,
                    keyIndex,
                }),
            );
        });

        test("detects UTXOs at the rescue-derived intermediary Liquid address", async () => {
            mockGetAddressUTXOs.mockResolvedValue([{ txid: "tx", vout: 0 }]);

            const result = await checkTempWalletForUtxos(rescueFile, {
                id: "swap-id",
                type: SwapType.Reverse,
                assetReceive: LUSDT,
                claimPrivateKeyIndex: 42,
            } as SomeSwap);

            expect(mockDeriveTempLiquidWallet).toHaveBeenCalledWith(
                rescueFile,
                42,
            );
            expect(mockGetAddressUTXOs).toHaveBeenCalledWith(
                LBTC,
                "el1qtempwallet42",
            );
            expect(result).toEqual({
                address: "el1qtempwallet42",
                keyIndex: 42,
            });
        });

        test("falls back to stored SideSwap temp key index", async () => {
            mockGetAddressUTXOs.mockResolvedValue([{ txid: "tx", vout: 0 }]);

            const result = await checkTempWalletForUtxos(rescueFile, {
                id: "swap-id",
                type: SwapType.Chain,
                assetReceive: LUSDT,
                sideswap: {
                    tempKeyIndex: 7,
                } as SideSwapDetail,
            } as SomeSwap);

            expect(mockDeriveTempLiquidWallet).toHaveBeenCalledWith(
                rescueFile,
                7,
            );
            expect(result).toEqual({
                address: "el1qtempwallet7",
                keyIndex: 7,
            });
        });

        test("does not scan non-Liquid receive assets", async () => {
            const result = await checkTempWalletForUtxos(rescueFile, {
                id: "swap-id",
                type: SwapType.Reverse,
                assetReceive: BTC,
                claimPrivateKeyIndex: 42,
            } as SomeSwap);

            expect(result).toBeUndefined();
            expect(mockDeriveTempLiquidWallet).not.toHaveBeenCalled();
            expect(mockGetAddressUTXOs).not.toHaveBeenCalled();
        });

        test("enriches swaps with failed SideSwap metadata when stuck temp funds are found", async () => {
            mockGetAddressUTXOs.mockResolvedValue([{ txid: "tx", vout: 0 }]);

            const [result] = await enrichSwapsWithTempWalletData(rescueFile, [
                {
                    id: "swap-id",
                    type: SwapType.Reverse,
                    assetReceive: LUSDT,
                    claimPrivateKeyIndex: 42,
                } as SomeSwap,
            ]);

            expect(result.sideswap).toMatchObject({
                status: SideSwapStatus.Failed,
                tempAddress: "el1qtempwallet42",
                tempKeyIndex: 42,
            });
        });

        test("marks failed SideSwap temp-wallet swaps as refundable", async () => {
            const [result] = await createRescueList(
                [
                    {
                        id: "swap-id",
                        type: SwapType.Reverse,
                        status: swapStatusSuccess.TransactionClaimed,
                        assetSend: BTC,
                        assetReceive: LUSDT,
                        sideswap: {
                            status: SideSwapStatus.Failed,
                            tempAddress: "el1qtempwallet42",
                        } as SideSwapDetail,
                    } as SomeSwap,
                ],
                zeroConf,
            );

            expect(result.action).toBe(RescueAction.Refund);
        });
    });
});
