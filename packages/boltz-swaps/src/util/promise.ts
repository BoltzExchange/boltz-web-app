// Resolves with the first fulfilled promise. Rejects immediately with the
// first error satisfying `prefer`, else with the last error once all rejected.
export const firstResolvedPreferring = <T>(
    promises: Promise<T>[],
    prefer: (error: unknown) => boolean,
): Promise<T> => {
    if (promises.length === 0) {
        throw new Error("no promises provided");
    }

    return new Promise<T>((resolve, reject) => {
        let rejectionCount = 0;
        let lastError: unknown;

        promises.forEach((promise) => {
            promise.then(resolve).catch((error) => {
                if (prefer(error)) {
                    reject(error);
                    return;
                }
                rejectionCount++;
                lastError = error;
                if (rejectionCount === promises.length) {
                    reject(lastError);
                }
            });
        });
    });
};

export const firstResolved = <T>(promises: Promise<T>[]): Promise<T> =>
    firstResolvedPreferring(promises, () => false);

export const promiseWithTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = "Timeout",
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(errorMessage)),
            timeoutMs,
        );
    });

    return Promise.race([promise, timeoutPromise]).finally(() =>
        clearTimeout(timeoutId),
    );
};
