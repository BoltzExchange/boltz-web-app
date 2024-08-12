const requestValidSeconds = 172800;

const deployOnlyRequestKeys: string[] = ["index"];

export const isDeployRequest = (request: Record<string, any>): boolean => {
    return deployOnlyRequestKeys.every((key) => {
        return key in request.request;
    });
};

export const calculateGasPrice = (
    gasPrice: number | string | bigint,
    minGasPrice: string,
): BigInt => {
    const bigGasPrice = BigInt(gasPrice);
    const bigMinGasPrice = BigInt(minGasPrice);

    return BigInt(bigGasPrice < bigMinGasPrice ? bigMinGasPrice : bigGasPrice);
};

export const getValidUntilTime = () =>
    Math.round(Date.now() / 1000) + requestValidSeconds;
