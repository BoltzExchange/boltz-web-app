import {
    type ClaimResult,
    type ClaimAssetParams as LibClaimAssetParams,
    type PopulatedEvmTransaction,
    claimAsset as libClaimAsset,
} from "boltz-swaps/evm/transaction";
import { GasAbstractionType } from "boltz-swaps/types";
import log from "loglevel";
import type { Accessor } from "solid-js";
import type { Hash } from "viem";

import {
    type AlchemyCall,
    type SendAlchemyTransactionOptions,
    sendTransaction as sendAlchemyTransaction,
    toAlchemyCall,
} from "../alchemy/Alchemy";
import type { Signer } from "../context/Web3";
import { relayClaimTransaction } from "../rif/Signer";

type SendPopulatedTransactionOptions = {
    alchemy?: SendAlchemyTransactionOptions;
};

export type ClaimAssetParams = Omit<
    LibClaimAssetParams,
    "getSigner" | "sendTransaction" | "relayClaimTransaction"
> & {
    signer: Accessor<Signer>;
};

const transactionHashFromResponse = (response: unknown): Hash => {
    if (typeof response === "string") {
        return response as Hash;
    }
    if (typeof response === "object" && response !== null) {
        const hash = Reflect.get(response, "hash");
        if (typeof hash === "string") {
            return hash as Hash;
        }
    }
    throw new Error("transaction response did not include a hash");
};

export const sendPopulatedTransaction = async (
    gasAbstraction: GasAbstractionType,
    signer: Signer,
    transaction: PopulatedEvmTransaction | AlchemyCall[],
    options?: SendPopulatedTransactionOptions,
): Promise<Hash> => {
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
            // viem's `sendTransaction` discriminates between legacy / EIP-1559
            // / blob branches; `PopulatedEvmTransaction` deliberately stays
            // mode-agnostic because we receive it from upstream populators that
            // pick the mode at runtime. Cast through `never` to bypass the
            // exhaustive discriminator on the request shape.
            const params = {
                account:
                    signer.account.type === "local"
                        ? signer.account
                        : signer.address,
                chain: null,
                ...transaction,
            } as never;
            const response = await signer.sendTransaction(params);
            return transactionHashFromResponse(response);
        }

        case GasAbstractionType.Signer: {
            const calls = Array.isArray(transaction)
                ? transaction
                : [toAlchemyCall(transaction)];
            log.debug("Sending transaction via Alchemy", calls);

            const chainId = BigInt(await signer.provider.getChainId());
            return await sendAlchemyTransaction(
                signer,
                chainId,
                calls,
                options?.alchemy,
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

export const claimAsset = ({
    signer,
    ...params
}: ClaimAssetParams): Promise<ClaimResult> =>
    libClaimAsset({
        ...params,
        getSigner: signer,
        sendTransaction: sendPopulatedTransaction,
        relayClaimTransaction,
    });
