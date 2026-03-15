import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import {
    type TransactionReceipt,
    type TransactionRequest,
    type Wallet,
} from "ethers";
import log from "loglevel";

import {
    type AlchemyCall,
    sendTransaction as sendAlchemyTransaction,
} from "../alchemy/Alchemy";
import type { Signer } from "../context/Web3";
import { GasAbstractionType } from "./swapCreator";

export type LockupEvent = {
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
    transaction: TransactionRequest | AlchemyCall[],
): Promise<string> => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay: {
            if (Array.isArray(transaction)) {
                throw new Error("Transaction is an array of Alchemy calls");
            }

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

            const isCalls = Array.isArray(transaction);
            log.debug(
                "Sending transaction via Alchemy",
                isCalls
                    ? transaction.map((call) => ({
                          to: call.to,
                          data: call.data,
                          value: call.value?.toString() ?? undefined,
                      }))
                    : [
                          {
                              to: transaction.to as string,
                              data: transaction.data,
                              value: transaction.value?.toString() ?? undefined,
                          },
                      ],
            );

            const { chainId } = await signer.provider.getNetwork();
            return await sendAlchemyTransaction(
                signer as Wallet,
                chainId,
                isCalls
                    ? transaction
                    : [
                          {
                              data: transaction.data,
                              to: transaction.to as string,
                              value: transaction.value?.toString() ?? undefined,
                          },
                      ],
            );
        }

        default: {
            const exhaustiveCheck: never = gasAbstraction;
            throw new Error(
                `Unsupported gas abstraction type: ${String(exhaustiveCheck)}`,
            );
        }
    }
};

export const assertTransactionSignerProvider = (
    signer: Signer | Wallet,
    context = "transaction signer",
) => {
    if (signer.provider === null) {
        throw new Error(`${context} requires a provider`);
    }

    return signer.provider;
};

export const getLockupEvent = (
    contract: EtherSwap | ERC20Swap,
    receipt: TransactionReceipt,
    contractAddress: string,
): LockupEvent => {
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
