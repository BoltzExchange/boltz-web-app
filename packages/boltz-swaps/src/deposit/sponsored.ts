import { type Hex, encodeFunctionData, getAddress, maxUint256 } from "viem";

import { sendPopulatedTransaction } from "../evm/sender.ts";
import type { PopulatedEvmTransaction } from "../evm/transaction.ts";
import { erc20Abi } from "../generated/evm-abis.ts";
import type { Signer } from "../interfaces/signer.ts";
import { GasAbstractionType } from "../types.ts";

// Submit a single gas-sponsored (EIP-7702) call and return its tx hash. Always
// ONE call per send: `sendAlchemyTransaction` returns `receipts[0]`, so a
// batched `[approve, action]` would return the approve tx — we never batch.
export const sendSponsored = (
    signer: Signer,
    tx: PopulatedEvmTransaction,
): Promise<Hex> =>
    sendPopulatedTransaction(GasAbstractionType.Signer, signer, tx);

// One-time unlimited ERC20 approval of `spender`, gas-sponsored. Skips the
// on-chain approve when the existing allowance already covers `needed`, so a
// reusable deposit address pays the approve at most once per (token, spender).
export const ensureUnlimitedApproval = async (
    signer: Signer,
    token: string,
    spender: string,
    needed: bigint,
): Promise<void> => {
    const allowance = await signer.provider.readContract({
        address: getAddress(token),
        abi: erc20Abi,
        functionName: "allowance",
        args: [getAddress(signer.address), getAddress(spender)],
    });
    if (allowance >= needed) {
        return;
    }
    await sendSponsored(signer, {
        to: getAddress(token),
        data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [getAddress(spender), maxUint256],
        }),
    });
};
