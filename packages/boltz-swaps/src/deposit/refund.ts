import { type Hex, encodeFunctionData, getAddress, parseSignature } from "viem";

import { vFromSignature } from "../bridge/signature.ts";
import { getCommitmentLockupDetails } from "../client.ts";
import { getEvmRefundCooperativeSignature } from "../evm/commitment.ts";
import { getLockupEvent } from "../evm/transaction.ts";
import { erc20SwapAbi } from "../generated/evm-abis.ts";
import type { Signer } from "../interfaces/signer.ts";
import { getLogger } from "../logger.ts";
import { sendSponsored } from "./sponsored.ts";
import { DEPOSIT_BRIDGE_ASSET } from "./types.ts";

// Cooperatively refund an UNBOUND empty-preimage commitment (locked but never
// bound to a swap — e.g. the consumer rejected the quote). Gas-sponsored,
// mirrors the host `RefundButton.tsx` ERC20 commitment-refund path. The lockup
// args are re-parsed from the commitment tx so no extra state is persisted.
export const sponsoredCommitmentRefund = async ({
    commitmentTxHash,
    signer,
}: {
    commitmentTxHash: string;
    signer: Signer;
}): Promise<string> => {
    const log = getLogger();
    const { contract } = await getCommitmentLockupDetails(DEPOSIT_BRIDGE_ASSET);
    const swapContract = getAddress(contract);

    const receipt = await signer.provider.waitForTransactionReceipt({
        hash: commitmentTxHash as Hex,
    });
    const lockup = getLockupEvent(erc20SwapAbi, receipt, swapContract);
    if (lockup.tokenAddress === undefined) {
        throw new Error("missing tokenAddress in commitment lockup event");
    }

    const signatureHex = await getEvmRefundCooperativeSignature({
        isCommitmentLockup: true,
        asset: DEPOSIT_BRIDGE_ASSET,
        commitmentTxHash,
        logIndex: lockup.logIndex,
        signer,
    });
    const signature = parseSignature(signatureHex);

    const refundTxHash = await sendSponsored(signer, {
        to: swapContract,
        data: encodeFunctionData({
            abi: erc20SwapAbi,
            functionName: "refundCooperative",
            args: [
                lockup.preimageHash as Hex,
                lockup.amount,
                getAddress(lockup.tokenAddress),
                getAddress(lockup.claimAddress),
                getAddress(lockup.refundAddress),
                lockup.timelock,
                vFromSignature(signature),
                signature.r,
                signature.s,
            ],
        }),
    });

    log.info("Refunded unbound commitment", {
        commitmentTxHash,
        refundTxHash,
    });
    return refundTxHash;
};
