export const swapStatusPending = {
    InvoiceSet: "invoice.set",
    InvoicePending: "invoice.pending",
    SwapCreated: "swap.created",
    TransactionConfirmed: "transaction.confirmed",
    TransactionMempool: "transaction.mempool",
    TransactionClaimPending: "transaction.claim.pending",
    TransactionServerMempool: "transaction.server.mempool",
    TransactionServerConfirmed: "transaction.server.confirmed",
};

export const swapStatusFailed = {
    SwapExpired: "swap.expired",
    SwapRefunded: "swap.refunded",
    InvoiceExpired: "invoice.expired",
    InvoiceFailedToPay: "invoice.failedToPay",
    TransactionFailed: "transaction.failed",
    TransactionLockupFailed: "transaction.lockupFailed",
    TransactionRefunded: "transaction.refunded",
};

export const swapStatusSuccess = {
    InvoiceSettled: "invoice.settled",
    TransactionClaimed: "transaction.claimed",
};

export const swapStatusFinal = [
    swapStatusFailed.InvoiceExpired,
    swapStatusFailed.SwapExpired,
    swapStatusFailed.SwapRefunded,
    swapStatusFailed.InvoiceFailedToPay,
    swapStatusFailed.TransactionRefunded,
].concat(Object.values(swapStatusSuccess));
