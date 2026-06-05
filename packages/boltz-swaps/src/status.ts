export const SwapStatus = {
    // Pending
    InvoiceSet: "invoice.set",
    InvoicePaid: "invoice.paid",
    InvoicePending: "invoice.pending",
    SwapCreated: "swap.created",
    TransactionConfirmed: "transaction.confirmed",
    TransactionMempool: "transaction.mempool",
    TransactionZeroConfRejected: "transaction.zeroconf.rejected",
    TransactionClaimPending: "transaction.claim.pending",
    TransactionServerMempool: "transaction.server.mempool",
    TransactionServerConfirmed: "transaction.server.confirmed",

    // Failed
    SwapExpired: "swap.expired",
    SwapRefunded: "swap.refunded",
    SwapWaitingForRefund: "swap.waitingForRefund",
    InvoiceExpired: "invoice.expired",
    InvoiceFailedToPay: "invoice.failedToPay",
    TransactionFailed: "transaction.failed",
    TransactionLockupFailed: "transaction.lockupFailed",
    TransactionRefunded: "transaction.refunded",

    // Success
    InvoiceSettled: "invoice.settled",
    TransactionClaimed: "transaction.claimed",
} as const;

export type SwapStatusValue = (typeof SwapStatus)[keyof typeof SwapStatus];

const FAILURE_STATUSES: ReadonlySet<string> = new Set([
    SwapStatus.SwapExpired,
    SwapStatus.SwapRefunded,
    SwapStatus.SwapWaitingForRefund,
    SwapStatus.InvoiceExpired,
    SwapStatus.InvoiceFailedToPay,
    SwapStatus.TransactionFailed,
    SwapStatus.TransactionLockupFailed,
    SwapStatus.TransactionRefunded,
]);

const SUCCESS_STATUSES: ReadonlySet<string> = new Set([
    SwapStatus.InvoiceSettled,
    SwapStatus.TransactionClaimed,
]);

// A swap reached a state from which it cannot complete a claim.
export const isFailureStatus = (status: string): boolean =>
    FAILURE_STATUSES.has(status);

// A swap completed successfully.
export const isSuccessStatus = (status: string): boolean =>
    SUCCESS_STATUSES.has(status);

// Terminal: the swap will not progress further on its own (success or hard
// failure). Used to stop watching/polling.
export const isFinalStatus = (status: string): boolean =>
    isFailureStatus(status) || isSuccessStatus(status);

// Whether a chain swap can be claimed at the given status.
export const isChainSwapClaimable = (args: {
    status: string;
    zeroConf?: boolean;
}): boolean => {
    if (args.status === SwapStatus.TransactionServerConfirmed) {
        return true;
    }
    return (
        args.zeroConf === true &&
        args.status === SwapStatus.TransactionServerMempool
    );
};
