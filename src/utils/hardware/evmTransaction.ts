import type { FeeData, TransactionLike } from "ethers";

type Quantity = bigint | number | string | null | undefined;

export type HardwareTransactionLike = TransactionLike & {
    gas?: Quantity;
    gasLimit?: Quantity;
    gasPrice?: Quantity;
    maxFeePerGas?: Quantity;
    maxPriorityFeePerGas?: Quantity;
    nonce?: Quantity;
    type?: Quantity;
};

type BaseResolvedTransaction = {
    chainId: bigint;
    data?: string;
    gasLimit: bigint;
    nonce: number;
    to?: string | null;
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

const toBigInt = (value: Quantity): bigint | undefined => {
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
    return `0x${BigInt(value).toString(16)}`;
};

export const resolveHardwareTransaction = (
    txParams: HardwareTransactionLike,
    chainId: bigint,
    fallbackNonce: number,
    feeData: FeeData,
): ResolvedHardwareTransaction => {
    const gasLimit = toBigInt(txParams.gasLimit ?? txParams.gas);
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
        data: txParams.data?.toString(),
        gasLimit,
        nonce,
        to: txParams.to === null ? null : txParams.to?.toString(),
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
