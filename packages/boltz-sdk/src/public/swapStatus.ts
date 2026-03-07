/** Swap status strings indicating the swap is still in progress. */
export const swapStatusPending = {
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
};

/** Swap status strings indicating a terminal failure state. */
export const swapStatusFailed = {
    SwapExpired: "swap.expired",
    SwapRefunded: "swap.refunded",
    SwapWaitingForRefund: "swap.waitingForRefund",
    InvoiceExpired: "invoice.expired",
    InvoiceFailedToPay: "invoice.failedToPay",
    TransactionFailed: "transaction.failed",
    TransactionLockupFailed: "transaction.lockupFailed",
    TransactionRefunded: "transaction.refunded",
};

/** Swap status strings indicating successful completion. */
export const swapStatusSuccess = {
    InvoiceSettled: "invoice.settled",
    TransactionClaimed: "transaction.claimed",
};

/** All terminal status strings (both failed and successful). */
export const swapStatusFinal = [
    swapStatusFailed.InvoiceExpired,
    swapStatusFailed.SwapExpired,
    swapStatusFailed.SwapRefunded,
    swapStatusFailed.InvoiceFailedToPay,
    swapStatusFailed.TransactionRefunded,
].concat(Object.values(swapStatusSuccess));
