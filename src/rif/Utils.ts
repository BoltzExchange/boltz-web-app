const requestValidSeconds = 172800;

const deployOnlyRequestKeys: string[] = ["index"];

export const isDeployRequest = (request: {
    request: Record<string, unknown>;
}): boolean => {
    return deployOnlyRequestKeys.every((key) => {
        return key in request.request;
    });
};

export const calculateGasPrice = (
    gasPrice: number | string | bigint,
    minGasPrice: string,
): bigint => {
    const bigGasPrice = BigInt(gasPrice);
    const bigMinGasPrice = BigInt(minGasPrice);

    return BigInt(bigGasPrice < bigMinGasPrice ? bigMinGasPrice : bigGasPrice);
};

export const getValidUntilTime = () =>
    Math.round(Date.now() / 1000) + requestValidSeconds;
