import { createAssetProvider } from "boltz-swaps/evm";
import {
    type Hash,
    type Log,
    erc20Abi,
    getAddress,
    isAddressEqual,
    parseEventLogs,
} from "viem";

import { requireRouterAddress } from "../consts/Assets";

export const lockupGasUsage = 46_000n;

export const getNativeEvmLockupSpendableBalance = (
    balance: bigint,
    gasPrice: bigint,
) => {
    const reserve = gasPrice * lockupGasUsage;
    return balance > reserve ? balance - reserve : 0n;
};

// Gas-abstraction lockups are sent by the gas key, so the funding EOA can
// only be recovered from the Permit2 pull (tokenIn -> router) in the receipt.
export const findLockupTokenFunder = (
    logs: Log[],
    tokenIn: string,
    routerAddress: string,
): string | undefined => {
    const token = getAddress(tokenIn);
    const router = getAddress(routerAddress);

    return parseEventLogs({
        abi: erc20Abi,
        eventName: "Transfer",
        logs,
    }).find(
        (transfer) =>
            isAddressEqual(getAddress(transfer.address), token) &&
            isAddressEqual(transfer.args.to, router) &&
            !isAddressEqual(transfer.args.from, router),
    )?.args.from;
};

export const resolveLockupTokenFunder = async (
    asset: string,
    tokenIn: string,
    lockupTxHash: string,
): Promise<string | undefined> => {
    const receipt = await createAssetProvider(asset).getTransactionReceipt({
        hash: lockupTxHash as Hash,
    });
    if (receipt === null) {
        return undefined;
    }

    return findLockupTokenFunder(
        receipt.logs,
        tokenIn,
        requireRouterAddress(asset),
    );
};
