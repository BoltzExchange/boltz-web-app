import {
    SwapStatus,
    isChainSwapClaimable,
    isFailureStatus,
    isFinalStatus,
    isSuccessStatus,
} from "boltz-swaps/status";

describe("status predicates", () => {
    describe("isChainSwapClaimable", () => {
        test("returns true for TransactionServerConfirmed regardless of zeroConf", () => {
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerConfirmed,
                }),
            ).toBe(true);
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerConfirmed,
                    zeroConf: false,
                }),
            ).toBe(true);
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerConfirmed,
                    zeroConf: true,
                }),
            ).toBe(true);
        });

        test("returns true for TransactionServerMempool when zeroConf === true", () => {
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerMempool,
                    zeroConf: true,
                }),
            ).toBe(true);
        });

        test("returns false for TransactionServerMempool when zeroConf is undefined or false", () => {
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerMempool,
                }),
            ).toBe(false);
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerMempool,
                    zeroConf: false,
                }),
            ).toBe(false);
        });

        test("returns false for TransactionServerMempool when zeroConf is truthy but not strictly true", () => {
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerMempool,
                    zeroConf: 1 as unknown as boolean,
                }),
            ).toBe(false);
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerMempool,
                    zeroConf: "true" as unknown as boolean,
                }),
            ).toBe(false);
        });

        test("returns false for non-server statuses even when zeroConf === true", () => {
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionMempool,
                    zeroConf: true,
                }),
            ).toBe(false);
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionConfirmed,
                    zeroConf: true,
                }),
            ).toBe(false);
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionClaimed,
                    zeroConf: true,
                }),
            ).toBe(false);
            expect(
                isChainSwapClaimable({
                    status: "totally.unknown",
                    zeroConf: true,
                }),
            ).toBe(false);
        });
    });

    describe("isFailureStatus", () => {
        it.each([
            SwapStatus.SwapExpired,
            SwapStatus.SwapRefunded,
            SwapStatus.SwapWaitingForRefund,
            SwapStatus.InvoiceExpired,
            SwapStatus.InvoiceFailedToPay,
            SwapStatus.TransactionFailed,
            SwapStatus.TransactionLockupFailed,
            SwapStatus.TransactionRefunded,
        ])("returns true for failure status %s", (status) => {
            expect(isFailureStatus(status)).toBe(true);
        });

        it.each([
            SwapStatus.InvoiceSettled,
            SwapStatus.InvoicePending,
            SwapStatus.TransactionServerConfirmed,
            SwapStatus.TransactionServerMempool,
            "totally.unknown",
        ])("returns false for non-failure status %s", (status) => {
            expect(isFailureStatus(status)).toBe(false);
        });
    });

    describe("isSuccessStatus", () => {
        it.each([SwapStatus.InvoiceSettled, SwapStatus.TransactionClaimed])(
            "returns true for success status %s",
            (status) => {
                expect(isSuccessStatus(status)).toBe(true);
            },
        );

        it.each([
            SwapStatus.SwapExpired,
            SwapStatus.TransactionServerConfirmed,
            SwapStatus.InvoicePending,
            "totally.unknown",
        ])("returns false for non-success status %s", (status) => {
            expect(isSuccessStatus(status)).toBe(false);
        });
    });

    describe("isFinalStatus", () => {
        it.each([
            SwapStatus.SwapExpired,
            SwapStatus.SwapRefunded,
            SwapStatus.SwapWaitingForRefund,
            SwapStatus.InvoiceExpired,
            SwapStatus.InvoiceFailedToPay,
            SwapStatus.TransactionFailed,
            SwapStatus.TransactionLockupFailed,
            SwapStatus.TransactionRefunded,
            SwapStatus.InvoiceSettled,
            SwapStatus.TransactionClaimed,
        ])("returns true for final status %s", (status) => {
            expect(isFinalStatus(status)).toBe(true);
        });

        it.each([
            SwapStatus.InvoicePending,
            SwapStatus.SwapCreated,
            SwapStatus.TransactionServerMempool,
            SwapStatus.TransactionServerConfirmed,
            "totally.unknown",
        ])("returns false for non-final status %s", (status) => {
            expect(isFinalStatus(status)).toBe(false);
        });
    });

    describe("cross-predicate invariants", () => {
        test("a claimable server status is never final", () => {
            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerConfirmed,
                }),
            ).toBe(true);
            expect(isFinalStatus(SwapStatus.TransactionServerConfirmed)).toBe(
                false,
            );

            expect(
                isChainSwapClaimable({
                    status: SwapStatus.TransactionServerMempool,
                    zeroConf: true,
                }),
            ).toBe(true);
            expect(isFinalStatus(SwapStatus.TransactionServerMempool)).toBe(
                false,
            );
        });
    });

    describe("edge cases", () => {
        test("empty string is never failure, success, final, or claimable", () => {
            expect(isFailureStatus("")).toBe(false);
            expect(isSuccessStatus("")).toBe(false);
            expect(isFinalStatus("")).toBe(false);
            expect(isChainSwapClaimable({ status: "" })).toBe(false);
        });

        test("matching is exact-string and case-sensitive", () => {
            expect(isFinalStatus("Swap.Expired")).toBe(false);
            expect(isFailureStatus("SWAP.EXPIRED")).toBe(false);
            expect(isSuccessStatus("Invoice.Settled")).toBe(false);
            expect(
                isChainSwapClaimable({
                    status: "Transaction.Server.Confirmed",
                }),
            ).toBe(false);
        });
    });
});
