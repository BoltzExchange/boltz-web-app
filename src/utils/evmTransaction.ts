import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import {
    type TransactionReceipt,
    type TransactionRequest,
    type Wallet,
} from "ethers";
import log from "loglevel";

import { sendTransaction as sendAlchemyTransaction } from "../alchemy/Alchemy";
import type { Signer } from "../context/Web3";
import { GasAbstractionType } from "./swapCreator";

export type CommitmentLockupEvent = {
    preimageHash: string;
    amount: bigint;
    tokenAddress?: string;
    claimAddress: string;
    refundAddress: string;
    timelock: bigint;
    logIndex: number;
};

export const getSignerForGasAbstraction = (
    gasAbstraction: GasAbstractionType,
    signer: Signer,
    gasAbstractionSigner: Wallet,
): Signer | Wallet => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay:
            return signer;

        case GasAbstractionType.Signer:
            return gasAbstractionSigner;
    }
};

export const sendPopulatedTransaction = async (
    gasAbstraction: GasAbstractionType,
    signer: Signer | Wallet,
    transaction: TransactionRequest,
): Promise<string> => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay: {
            log.debug(
                "Sending transaction via signer",
                transaction.to,
                transaction.data,
            );
            const response = await signer.sendTransaction(transaction);
            return response.hash;
        }

        case GasAbstractionType.Signer: {
            if (signer.provider === null) {
                throw new Error(
                    "gas abstraction signer requires a provider to send via Alchemy",
                );
            }

            log.debug(
                "Sending transaction via Alchemy",
                transaction.to,
                transaction.data,
            );

            const { chainId } = await signer.provider.getNetwork();
            return await sendAlchemyTransaction(signer as Wallet, chainId, [
                {
                    data: transaction.data,
                    to: transaction.to as string,
                    value: transaction.value?.toString() ?? undefined,
                },
            ]);
        }

        default: {
            const exhaustiveCheck: never = gasAbstraction;
            throw new Error(
                `Unsupported gas abstraction type: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const getLockupEvent = (
    contract: EtherSwap | ERC20Swap,
    receipt: TransactionReceipt,
    contractAddress: string,
): CommitmentLockupEvent => {
    const lockupLog = receipt.logs.find((eventLog) => {
        if (eventLog.address.toLowerCase() !== contractAddress.toLowerCase()) {
            return false;
        }

        try {
            const parsedLog = contract.interface.parseLog({
                data: eventLog.data,
                topics: eventLog.topics,
            });
            return parsedLog?.name === "Lockup";
        } catch {
            return false;
        }
    });

    if (lockupLog === undefined) {
        throw new Error("could not find commitment lockup event");
    }

    const parsedLockup = contract.interface.parseLog({
        data: lockupLog.data,
        topics: lockupLog.topics,
    });
    if (parsedLockup?.name !== "Lockup") {
        throw new Error("could not parse commitment lockup event");
    }

    const {
        amount,
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock,
        preimageHash,
    } = parsedLockup.args;

    return {
        amount,
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock,
        preimageHash,
        logIndex: lockupLog.index,
    };
};
