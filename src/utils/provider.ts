import type { PublicClient } from "viem";

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
