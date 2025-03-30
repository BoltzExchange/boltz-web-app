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
