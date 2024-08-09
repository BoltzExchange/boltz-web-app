import { Provider } from "ethers";

const requestValidSeconds = 172800;

const deployOnlyRequestKeys: string[] = ["index"];

export const isDeployRequest = (request: Record<string, any>): boolean => {
    return deployOnlyRequestKeys.every((key) => {
        return key in request.request;
    });
};

export const calculateGasPrice = async (
    provider: Provider,
    minGasPrice: string,
): Promise<BigInt> => {
    const gasPrice = BigInt((await provider.getFeeData()).gasPrice.toString());
    const bigMinGasPrice = BigInt(minGasPrice);

    return BigInt(gasPrice < bigMinGasPrice ? bigMinGasPrice : gasPrice);
};

export const getValidUntilTime = () =>
    Math.round(Date.now() / 1000) + requestValidSeconds;
