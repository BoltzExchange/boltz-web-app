import BigNumber from "bignumber.js";

// Same-tab serialization fallback for browsers without the Web Locks API.
const fallbackQueues = new Map<string, Promise<unknown>>();

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

// Keeps backend quote acceptance/local persistence ordered before claim reads.
export const withChainSwapQuoteLock = <T>(
    swapId: string,
    fn: () => Promise<T>,
): Promise<T> => {
    if (navigator.locks?.request !== undefined) {
        return navigator.locks.request(
            `chainSwapReplacementQuote:${swapId}`,
            fn,
        );
    }

    const previous = fallbackQueues.get(swapId) ?? Promise.resolve();
    const current = previous.then(fn);
    fallbackQueues.set(
        swapId,
        current.catch(() => undefined),
    );
    return current;
};
