import { SwapType } from "boltz-swaps/types";

import { swapStatusPending } from "../consts/SwapStatus";
import type { SomeSwap } from "./swapCreator";

const initialCommitmentFundingStatuses = [
    swapStatusPending.SwapCreated,
    swapStatusPending.InvoiceSet,
];

const commitmentLockupStatuses = [
    swapStatusPending.TransactionMempool,
    swapStatusPending.TransactionConfirmed,
    swapStatusPending.TransactionServerMempool,
    swapStatusPending.TransactionServerConfirmed,
];

const hasCommittedLockup = (
    swap: SomeSwap | null | undefined,
): swap is SomeSwap & {
    commitmentLockup: true;
    commitmentLockupTxHash: string;
} =>
    swap !== null &&
    swap !== undefined &&
    swap.type !== SwapType.Commitment &&
    swap.commitmentLockup === true &&
    swap.commitmentLockupTxHash !== undefined;

const getStoredCommitmentLockupStatus = (swap: SomeSwap) =>
    swap.status !== undefined && commitmentLockupStatuses.includes(swap.status)
        ? swap.status
        : undefined;

export const getCommitmentLockupDisplayStatus = (
    swap: SomeSwap | null | undefined,
    status: string,
) => {
    if (
        !hasCommittedLockup(swap) ||
        !initialCommitmentFundingStatuses.includes(status)
    ) {
        return status;
    }

    return (
        getStoredCommitmentLockupStatus(swap) ??
        swapStatusPending.TransactionMempool
    );
};
