import { type Hash, type Hex } from "viem";

import {
    getEipRefundSignature,
    postCommitmentRefundSignature,
    postCommitmentSignature,
} from "../client.ts";
import { requireChainId } from "../config.ts";
import { erc20SwapAbi } from "../generated/evm-abis.ts";
import type { Signer } from "../interfaces/signer.ts";
import { getLogger } from "../logger.ts";
import { SwapType } from "../types.ts";
import type { Erc20SwapContract } from "./contracts.ts";
import { prefix0x } from "./prefix0x.ts";
import { createAssetProvider } from "./provider.ts";
import { getLockupEvent } from "./transaction.ts";

export const emptyPreimageHash = prefix0x("00".repeat(32));

export const normalizePreimageHash = (preimageHash: string | undefined) =>
    preimageHash?.replace(/^0x/i, "").toLowerCase();

export const isEmptyPreimageHash = (preimageHash: string | undefined) =>
    normalizePreimageHash(preimageHash) ===
    normalizePreimageHash(emptyPreimageHash);

type PostCommitmentSignatureParams = {
    asset: string;
    commitmentAsset: string;
    swapId: string;
    preimageHash: string;
    commitmentTxHash: Hash;
    erc20Swap: Erc20SwapContract;
    signer: Signer;
    waitTimeoutMs?: number;
};

// Backend caps maxOverpaymentPercentage at 10
// (lib/api/v2/routers/CommitmentRouter.ts). Send the max so the commitment
// post is not rejected for small over-lockups.
const maxAllowedOverpaymentPercentage = 10;

export const postCommitmentSignatureForTransaction = async ({
    asset,
    commitmentAsset,
    swapId,
    preimageHash,
    commitmentTxHash,
    erc20Swap,
    signer,
    waitTimeoutMs = 120_000,
}: PostCommitmentSignatureParams) => {
    const log = getLogger();
    log.info("Waiting for commitment lockup receipt", {
        asset,
        commitmentAsset,
        swapId,
        commitmentTxHash,
        waitTimeoutMs,
    });

    const commitmentProvider = createAssetProvider(commitmentAsset);
    const receipt = await commitmentProvider.waitForTransactionReceipt({
        hash: commitmentTxHash,
        confirmations: 1,
        timeout: waitTimeoutMs,
    });
    if (receipt === null) {
        throw new Error(
            "could not fetch commitment lockup transaction receipt",
        );
    }

    log.info("Commitment lockup receipt found", {
        asset,
        commitmentAsset,
        swapId,
        commitmentTxHash,
        blockNumber: receipt.blockNumber,
    });

    const chainId = BigInt(requireChainId(commitmentAsset));
    const version = await erc20Swap.read.version();

    const {
        amount,
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock,
        logIndex,
    } = getLockupEvent(erc20SwapAbi, receipt, erc20Swap.address);

    if (tokenAddress === undefined) {
        throw new Error("missing tokenAddress in commitment lockup event");
    }

    log.debug("Parsed commitment lockup event", {
        asset,
        swapId,
        commitmentTxHash,
        contractAddress: erc20Swap.address,
        chainId: chainId.toString(),
        amount: amount.toString(),
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock: timelock.toString(),
        logIndex,
    });

    const commitmentSignature = await signer.signTypedData({
        account: signer.account,
        domain: {
            name: "ERC20Swap",
            version: String(version),
            verifyingContract: erc20Swap.address,
            chainId,
        },
        types: {
            Commit: [
                { name: "preimageHash", type: "bytes32" },
                { name: "amount", type: "uint256" },
                { name: "tokenAddress", type: "address" },
                { name: "claimAddress", type: "address" },
                { name: "refundAddress", type: "address" },
                { name: "timelock", type: "uint256" },
            ],
        } as const,
        primaryType: "Commit",
        message: {
            preimageHash: prefix0x(preimageHash),
            amount,
            tokenAddress,
            claimAddress,
            refundAddress,
            timelock,
        },
    });

    log.debug("Signed commitment typed data", {
        asset,
        swapId,
        commitmentTxHash,
        contractAddress: erc20Swap.address,
    });

    await postCommitmentSignature(
        asset,
        swapId,
        commitmentSignature,
        commitmentTxHash,
        logIndex,
        maxAllowedOverpaymentPercentage,
    );

    log.info("Posted commitment signature", {
        asset,
        swapId,
        commitmentTxHash,
        logIndex,
    });
};

export const buildCommitmentRefundAuthMessage = (
    chainSymbol: string,
    transactionHash: string,
    logIndex: number | undefined,
) =>
    [
        "Boltz commitment refund authorization",
        `chain: ${chainSymbol}`,
        `transactionHash: ${transactionHash}`,
        `logIndex: ${logIndex ?? "none"}`,
    ].join("\n");

type GetCommitmentRefundSignatureParams = {
    chainSymbol: string;
    transactionHash: string;
    logIndex?: number;
    signer: Signer;
};

export const getCommitmentRefundSignature = async ({
    chainSymbol,
    transactionHash,
    logIndex,
    signer,
}: GetCommitmentRefundSignatureParams): Promise<Hex> => {
    const log = getLogger();
    const message = buildCommitmentRefundAuthMessage(
        chainSymbol,
        transactionHash,
        logIndex,
    );

    log.debug("Requesting commitment refund authorization signature", {
        chainSymbol,
        transactionHash,
        logIndex,
    });

    const refundAddressSignature = await signer.signMessage({
        account: signer.account,
        message,
    });

    const { signature } = await postCommitmentRefundSignature(
        chainSymbol,
        transactionHash,
        refundAddressSignature,
        logIndex,
    );

    log.info("Received commitment refund signature", {
        chainSymbol,
        transactionHash,
        logIndex,
    });

    return signature;
};

type GetEvmRefundCooperativeSignatureParams = {
    isCommitmentLockup: boolean;
    asset: string;
    swapId?: string;
    swapType?: SwapType;
    commitmentTxHash?: string;
    logIndex?: number;
    signer: Signer;
};

export const getEvmRefundCooperativeSignature = async ({
    isCommitmentLockup,
    asset,
    swapId,
    swapType,
    commitmentTxHash,
    logIndex,
    signer,
}: GetEvmRefundCooperativeSignatureParams): Promise<Hex> => {
    const log = getLogger();
    const fetchUnlinked = () => {
        if (commitmentTxHash === undefined) {
            throw new Error("commitment lockup transaction hash is required");
        }
        return getCommitmentRefundSignature({
            chainSymbol: asset,
            transactionHash: commitmentTxHash,
            logIndex,
            signer,
        });
    };

    if (isCommitmentLockup) {
        // Try the swap refund path first: a commitment funded with positive
        // slippage links to the swap, and /commitment/refund then errors with
        // "linked commitment cannot be marked as refunded".
        if (swapId !== undefined) {
            try {
                const { signature } = await getEipRefundSignature(
                    swapId,
                    swapType ?? SwapType.Submarine,
                );
                return signature;
            } catch (linkedRefundError) {
                log.warn(
                    "linked commitment refund signature failed, falling back to unlinked endpoint",
                    linkedRefundError,
                );
                return await fetchUnlinked();
            }
        }
        return await fetchUnlinked();
    }

    if (swapId === undefined) {
        throw new Error("swap id is required for cooperative refunds");
    }
    const { signature } = await getEipRefundSignature(
        swapId,
        swapType ?? SwapType.Submarine,
    );
    return signature;
};
