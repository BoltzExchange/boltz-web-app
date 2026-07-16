import BigNumber from "bignumber.js";

// 0-amount chain swaps persist 0 until a replacement quote is accepted, so
// claim paths must not treat such placeholder amounts as claimable.
export const isPositivePersistedAmount = (
    amount: number | string | undefined,
): amount is number | string => {
    if (amount === undefined) {
        return false;
    }

    try {
        const value = new BigNumber(amount);
        return value.isFinite() && value.isGreaterThan(0);
    } catch {
        return false;
    }
};

// Serializes replacement quote acceptance and claim execution for one swap.
export const withChainSwapQuoteLock = <T>(
    swapId: string,
    fn: () => Promise<T>,
): Promise<T> =>
    navigator.locks.request(`chainSwapReplacementQuote:${swapId}`, fn);
