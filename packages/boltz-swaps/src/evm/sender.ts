import type { Hash } from "viem";

import { GasAbstractionType } from "../types.ts";
import { sendAlchemyTransaction, toAlchemyCall } from "./alchemy.ts";
import type { SendTransactionFn } from "./transaction.ts";

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

/**
 * Default {@link SendTransactionFn} for SDK-driven EVM claims.
 *
 * - {@link GasAbstractionType.Signer}: gas-abstracted send through the
 *   configured Alchemy gas sponsor (the default for `execute`).
 * - {@link GasAbstractionType.None} / {@link GasAbstractionType.RifRelay}:
 *   broadcast directly with the connected viem signer.
 */
export const sendPopulatedTransaction: SendTransactionFn = async (
    gasAbstraction,
    signer,
    transaction,
) => {
    switch (gasAbstraction) {
        case GasAbstractionType.None:
        case GasAbstractionType.RifRelay: {
            if (Array.isArray(transaction)) {
                throw new Error(
                    "cannot broadcast batched calls without gas abstraction",
                );
            }
            // viem's `sendTransaction` discriminates between legacy / EIP-1559 /
            // blob branches; `PopulatedEvmTransaction` stays mode-agnostic, so
            // cast through `never` to bypass the request-shape discriminator.
            const params = {
                account:
                    signer.account.type === "local"
                        ? signer.account
                        : signer.address,
                chain: null,
                ...transaction,
            } as never;
            return transactionHashFromResponse(
                await signer.sendTransaction(params),
            );
        }

        case GasAbstractionType.Signer: {
            const calls = Array.isArray(transaction)
                ? transaction
                : [toAlchemyCall(transaction)];
            const chainId = BigInt(await signer.provider.getChainId());
            return sendAlchemyTransaction(signer, chainId, calls);
        }

        default: {
            const exhaustiveCheck: never = gasAbstraction;
            throw new Error(
                `Unsupported gas abstraction type: ${String(exhaustiveCheck)}`,
            );
        }
    }
};
