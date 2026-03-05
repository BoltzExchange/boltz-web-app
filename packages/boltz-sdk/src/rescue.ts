import { BTC, LBTC, RBTC, type RefundableAssetType } from "./assets";
import { SwapType } from "./enums";
import { swapStatusPending, swapStatusSuccess } from "./swapStatus";
import type {
    ChainSwap,
    ReverseSwap,
    SomeSwap,
    SubmarineSwap,
} from "./swapCreator";
import { isRsk } from "./swapCreator";

export enum RescueAction {
    Successful = "successful",
    Claim = "claim",
    Refund = "refund",
    Pending = "pending",
    Failed = "failed",
}

export enum RefundType {
    Cooperative = "cooperative",
    Uncooperative = "uncooperative",
    AssetRescue = "assetRescue",
}

export const RescueNoAction = [
    RescueAction.Successful,
    RescueAction.Pending,
    RescueAction.Failed,
];

export const blockTimeMinutes: Record<RefundableAssetType, number> = {
    [BTC]: 10,
    [LBTC]: 1,
    [RBTC]: 25 / 60,
};

export const getNetworkName = (asset: string) => {
    switch (asset) {
        case BTC:
            return "Bitcoin";
        case LBTC:
            return "Liquid";
        case RBTC:
            return "Rootstock";
        default:
            return "";
    }
};

export const isSwapClaimable = ({
    status,
    type,
    zeroConf,
    swap = undefined,
    includeSuccess = false,
    swapDate = undefined,
    backupImportTimestamp = undefined,
}: {
    status: string;
    type: SwapType;
    swap?: SomeSwap;
    zeroConf: boolean;
    includeSuccess?: boolean;
    swapDate?: number;
    backupImportTimestamp?: number;
}) => {
    if (swap !== undefined && isRsk(swap)) {
        return false;
    }

    // When a backup is imported, we only auto-claim successful swaps that were created
    // after the import timestamp. This prevents attempting to claim swaps that may have
    // already been completed before the backup was created
    const swapCreatedAfterBackup: boolean =
        backupImportTimestamp === undefined ||
        (swapDate !== undefined && swapDate >= backupImportTimestamp);

    switch (type) {
        case SwapType.Reverse: {
            const statuses = [swapStatusPending.TransactionConfirmed];

            if (zeroConf) {
                statuses.push(swapStatusPending.TransactionMempool);
            }

            if (includeSuccess && swapCreatedAfterBackup) {
                statuses.push(swapStatusSuccess.InvoiceSettled);
            }

            return statuses.includes(status);
        }
        case SwapType.Chain: {
            const statuses = [swapStatusPending.TransactionServerConfirmed];

            if (zeroConf) {
                statuses.push(swapStatusPending.TransactionServerMempool);
            }

            if (includeSuccess && swapCreatedAfterBackup) {
                statuses.push(swapStatusSuccess.TransactionClaimed);
            }

            return statuses.includes(status);
        }
        default:
            return false;
    }
};

export const hasSwapTimedOut = (swap: SomeSwap, currentBlockHeight: number) => {
    if (typeof currentBlockHeight !== "number") {
        return false;
    }

    const swapTimeoutBlockHeight: Record<SwapType, () => number> = {
        [SwapType.Chain]: () =>
            (swap as ChainSwap).lockupDetails.timeoutBlockHeight,
        [SwapType.Reverse]: () => (swap as ReverseSwap).timeoutBlockHeight,
        [SwapType.Submarine]: () => (swap as SubmarineSwap).timeoutBlockHeight,
    };

    return currentBlockHeight >= swapTimeoutBlockHeight[swap.type]();
};

export const isRefundableSwapType = (swap: SomeSwap) =>
    [SwapType.Chain, SwapType.Submarine].includes(swap.type);

export const getTimeoutEta = (
    asset: RefundableAssetType,
    timeoutBlockHeight: number,
    currentBlockHeight: number,
) => {
    const blocksRemaining = timeoutBlockHeight - currentBlockHeight;
    const secondsRemaining = blocksRemaining * blockTimeMinutes[asset] * 60;
    return Math.floor(Date.now() / 1000) + secondsRemaining;
};

