import log from "loglevel";

export const firstResolved = <T>(promises: Promise<T>[]): Promise<T> => {
    if (promises.length === 0) {
        throw new Error("no promises provided");
    }

    return new Promise<T>((resolve, reject) => {
        let rejectionCount = 0;

        promises.forEach((promise) => {
            promise
                .then((result) => {
                    resolve(result);
                })
                .catch((error) => {
                    rejectionCount++;

                    if (rejectionCount === promises.length) {
                        reject(error);
                    }
                });
        });
    });
};

export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
    isRetryable?: (error: unknown) => boolean,
): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            if (isRetryable !== undefined && !isRetryable(e)) {
                throw e;
            }
            const delay = baseDelayMs * 2 ** attempt;
            log.warn(
                `Attempt ${attempt + 1} failed, retrying in ${delay}ms`,
                e,
            );
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    return await fn();
};

export const promiseWithTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = "Timeout",
): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
            clearTimeout(timeoutId);
            reject(new Error(errorMessage));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
};
