import { setSwaps, swaps } from "../signals";

export const swapStatusPending = {
    TransactionConfirmed: "transaction.confirmed",
};

export const swapStatusFailed = {
    SwapExpired: "swap.expired",
    InvoiceFailedToPay: "invoice.failedToPay",
    TransactionLockupFailed: "transaction.lockupFailed",
};

export const swapStatusSuccess = {
    InvoiceSettled: "invoice.settled",
    TransactionClaimed: "transaction.claimed",
};

const swapStatusFinal = [
    swapStatusFailed.SwapExpired,
    swapStatusFailed.InvoiceFailedToPay,
].concat(Object.values(swapStatusSuccess));

export const updateSwapStatus = (id, newStatus) => {
    if (swapStatusFinal.includes(newStatus)) {
        const swapsTmp = swaps();
        const swap = swapsTmp.find((swap) => swap.id === id);

        if (swap.status !== newStatus) {
            swap.status = newStatus;
            setSwaps(swapsTmp);
            return true;
        }
    }

    return false;
};
