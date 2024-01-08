export const swapStatusPending = {
    TransactionConfirmed: "transaction.confirmed",
    TransactionMempool: "transaction.mempool",
};

export const swapStatusFailed = {
    SwapExpired: "swap.expired",
    SwapRefunded: "swap.refunded",
    InvoiceFailedToPay: "invoice.failedToPay",
    TransactionLockupFailed: "transaction.lockupFailed",
};

export const swapStatusSuccess = {
    InvoiceSettled: "invoice.settled",
    TransactionClaimed: "transaction.claimed",
};

export const swapStatusFinal = [
    swapStatusFailed.SwapExpired,
    swapStatusFailed.SwapRefunded,
    swapStatusFailed.InvoiceFailedToPay,
].concat(Object.values(swapStatusSuccess));
