import type { Address, Hex } from "viem";

import { prefix0x } from "../evmTransaction";

type Quantity = bigint | number | string | null | undefined;

export type HardwareFeeData = {
    gasPrice?: bigint | null;
    maxFeePerGas?: bigint | null;
    maxPriorityFeePerGas?: bigint | null;
};

export type HardwareTransactionLike = {
    data?: Hex;
    from?: Address;
    gas?: Quantity;
    gasLimit?: Quantity;
    gasPrice?: Quantity;
    maxFeePerGas?: Quantity;
    maxPriorityFeePerGas?: Quantity;
    nonce?: Quantity;
    to?: Address | null;
    type?: Quantity;
    value?: Quantity;
};

type BaseResolvedTransaction = {
    chainId: bigint;
    data?: Hex;
    gasLimit: bigint;
    nonce: number;
    to?: Address | null;
    value: bigint;
};

export type ResolvedHardwareTransaction =
    | (BaseResolvedTransaction & {
          maxFeePerGas: bigint;
          maxPriorityFeePerGas: bigint;
          type: 2;
      })
    | (BaseResolvedTransaction & {
          gasPrice: bigint;
          type: 0;
      });

export const toBigInt = (value: Quantity): bigint | undefined => {
    if (value === undefined || value === null) {
        return undefined;
    }

    return BigInt(value);
};

const toNumber = (value: Quantity): number | undefined => {
    if (value === undefined || value === null) {
        return undefined;
    }

    return Number(value);
};

export const toHexQuantity = (value: bigint | number): string => {
    return prefix0x(BigInt(value).toString(16));
};

export const resolveHardwareTransaction = (
    txParams: HardwareTransactionLike,
    chainId: bigint,
    fallbackNonce: number,
    feeData: HardwareFeeData,
    fallbackGas?: bigint,
): ResolvedHardwareTransaction => {
    const gasLimit = toBigInt(txParams.gasLimit ?? txParams.gas) ?? fallbackGas;
    if (gasLimit === undefined) {
        throw new Error("missing transaction gas limit");
    }

    const maxFeePerGas =
        toBigInt(txParams.maxFeePerGas) ?? feeData.maxFeePerGas ?? undefined;
    const maxPriorityFeePerGas =
        toBigInt(txParams.maxPriorityFeePerGas) ??
        feeData.maxPriorityFeePerGas ??
        undefined;
    const gasPrice =
        toBigInt(txParams.gasPrice) ?? feeData.gasPrice ?? undefined;
    const nonce = toNumber(txParams.nonce) ?? fallbackNonce;
    const txType = toNumber(txParams.type);

    const baseTransaction: BaseResolvedTransaction = {
        chainId,
        data: txParams.data,
        gasLimit,
        nonce,
        to: txParams.to,
        value: toBigInt(txParams.value) ?? 0n,
    };

    if (
        txType === 2 ||
        txParams.maxFeePerGas != null ||
        txParams.maxPriorityFeePerGas != null
    ) {
        if (maxFeePerGas === undefined || maxPriorityFeePerGas === undefined) {
            throw new Error("missing EIP-1559 fee data");
        }

        return {
            ...baseTransaction,
            maxFeePerGas,
            maxPriorityFeePerGas,
            type: 2,
        };
    }

    if (txType === 0 || txParams.gasPrice != null) {
        if (gasPrice === undefined) {
            throw new Error("missing legacy gas price");
        }

        return {
            ...baseTransaction,
            gasPrice,
            type: 0,
        };
    }

    if (maxFeePerGas !== undefined && maxPriorityFeePerGas !== undefined) {
        return {
            ...baseTransaction,
            maxFeePerGas,
            maxPriorityFeePerGas,
            type: 2,
        };
    }

    if (gasPrice !== undefined) {
        return {
            ...baseTransaction,
            gasPrice,
            type: 0,
        };
    }

    throw new Error("missing transaction fee data");
};
