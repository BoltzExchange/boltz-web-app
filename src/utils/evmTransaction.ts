import { type TransactionRequest, type Wallet } from "ethers";

import { sendTransaction as sendAlchemyTransaction } from "../alchemy/Alchemy";
import type { Signer } from "../context/Web3";
import { GasAbstractionType } from "./swapCreator";

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
            const response = await signer.sendTransaction(transaction);
            return response.hash;
        }

        case GasAbstractionType.Signer: {
            if (signer.provider === null) {
                throw new Error(
                    "gas abstraction signer requires a provider to send via Alchemy",
                );
            }

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
