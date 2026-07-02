export const lockupGasUsage = 46_000n;

export const getNativeEvmLockupSpendableBalance = (
    balance: bigint,
    gasPrice: bigint,
) => {
    const reserve = gasPrice * lockupGasUsage;
    return balance > reserve ? balance - reserve : 0n;
};
