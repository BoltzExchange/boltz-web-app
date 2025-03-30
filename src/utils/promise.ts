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
