import { type Hex, encodeFunctionData, getAddress } from "viem";

import { getCommitmentLockupDetails } from "../client.ts";
import { getTokenAddress } from "../config.ts";
import { emptyPreimageHash } from "../evm/commitment.ts";
import { getLockupEvent } from "../evm/transaction.ts";
import { erc20SwapAbi } from "../generated/evm-abis.ts";
import type { Signer } from "../interfaces/signer.ts";
import { getLogger } from "../logger.ts";
import { ensureUnlimitedApproval, sendSponsored } from "./sponsored.ts";
import { DEPOSIT_BRIDGE_ASSET } from "./types.ts";

export type CommitmentLockResult = {
    commitmentTxHash: string;
    commitmentLogIndex: number;
    contract: string;
    claimAddress: string;
    timelock: number;
};

// Build + broadcast the empty-preimage `ERC20Swap.lock` funded by the bridged
// Arbitrum USDC — the on-chain lock the SDK has no builder for today. Uses the
// 6-arg overload to set `refundAddress` explicitly to the derived address
// (rather than relying on `msg.sender` under 7702). A one-time unlimited
// approval of USDC to the ERC20Swap contract precedes it (reusable address).
//
// The lock is swap-agnostic (empty preimage); the engine's Binding phase later
// links it to the created swap via `postCommitmentSignatureForTransaction` with
// the real preimage hash.
export const sponsoredCommitmentLock = async ({
    amount,
    signer,
}: {
    amount: bigint;
    signer: Signer;
}): Promise<CommitmentLockResult> => {
    const log = getLogger();
    const { contract, claimAddress, timelock } =
        await getCommitmentLockupDetails(DEPOSIT_BRIDGE_ASSET);
    const swapContract = getAddress(contract);
    const tokenAddress = getAddress(getTokenAddress(DEPOSIT_BRIDGE_ASSET));
    const refundAddress = getAddress(signer.address);

    await ensureUnlimitedApproval(signer, tokenAddress, swapContract, amount);

    const data = encodeFunctionData({
        abi: erc20SwapAbi,
        functionName: "lock",
        args: [
            emptyPreimageHash as Hex,
            amount,
            tokenAddress,
            getAddress(claimAddress),
            refundAddress,
            BigInt(timelock),
        ],
    });

    const commitmentTxHash = await sendSponsored(signer, {
        to: swapContract,
        data,
    });
    const receipt = await signer.provider.waitForTransactionReceipt({
        hash: commitmentTxHash,
    });

    // Validate the parsed Lockup event before it can be bound (P0-3): a wrong
    // tx hash (e.g. an approve) has no Lockup event and throws here.
    const lockup = getLockupEvent(erc20SwapAbi, receipt, swapContract);
    if (lockup.amount !== amount) {
        throw new Error(
            `commitment lockup amount mismatch: locked ${amount}, event ${lockup.amount}`,
        );
    }
    if (
        lockup.tokenAddress === undefined ||
        getAddress(lockup.tokenAddress) !== tokenAddress
    ) {
        throw new Error("commitment lockup token address mismatch");
    }
    if (getAddress(lockup.refundAddress) !== refundAddress) {
        throw new Error("commitment lockup refund address mismatch");
    }

    log.info("Locked empty-preimage commitment", {
        commitmentTxHash,
        logIndex: lockup.logIndex,
        amount: amount.toString(),
    });

    return {
        commitmentTxHash,
        commitmentLogIndex: lockup.logIndex,
        contract: swapContract,
        claimAddress,
        timelock,
    };
};
