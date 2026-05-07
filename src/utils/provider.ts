import { type PublicClient, createPublicClient, fallback, http } from "viem";

import { config } from "../config";

export const getRpcUrls = (asset: string): readonly string[] | undefined => {
    const rpcUrls = config.assets?.[asset]?.network?.rpcUrls;

    return rpcUrls && rpcUrls.length > 0 ? rpcUrls : undefined;
};

export const requireRpcUrls = (asset: string): readonly string[] => {
    const rpcUrls = getRpcUrls(asset);
    if (rpcUrls === undefined || rpcUrls.length === 0) {
        throw new Error(`missing RPC configuration for asset: ${asset}`);
    }

    return rpcUrls;
};

export const createProviderTransport = (rpcUrls: readonly string[]) =>
    rpcUrls.length === 1
        ? http(rpcUrls[0])
        : fallback(
              rpcUrls.map((url) => http(url)),
              { rank: false },
          );

export const createProvider = (rpcUrls: readonly string[] | undefined) => {
    if (rpcUrls === undefined || rpcUrls.length === 0) {
        throw new Error("missing RPC configuration");
    }

    return createPublicClient({ transport: createProviderTransport(rpcUrls) });
};

export type FeeEstimate = {
    gasPrice: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    maxFeePerBlobGas?: bigint;
};

// Some legacy EVM RPCs do not support the fee endpoints viem uses for EIP-1559
// estimation. Falling back to eth_gasPrice keeps those chains working while
// preserving viem's native fee estimation everywhere it is available.
export const estimateFeesPerGas = async (
    provider: Pick<PublicClient, "estimateFeesPerGas" | "getGasPrice">,
): Promise<FeeEstimate> => {
    const fees = await provider.estimateFeesPerGas().catch(async () => ({
        gasPrice: await provider.getGasPrice(),
    }));

    return "gasPrice" in fees && fees.gasPrice !== undefined
        ? fees
        : {
              ...fees,
              gasPrice: await provider.getGasPrice(),
          };
};

export const createAssetProvider = (asset: string): PublicClient =>
    createProvider(requireRpcUrls(asset));
