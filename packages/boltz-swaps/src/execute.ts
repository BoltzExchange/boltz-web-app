import { hex } from "@scure/base";
import { getAddress, isAddressEqual } from "viem";

import {
    type ChainSwapCreatedResponse,
    broadcastApiTransaction,
    getChainSwapTransactions,
} from "./client.ts";
import { getConfiguredNetwork, getKindForAsset, isEvmAsset } from "./config.ts";
import { stripHexPrefix } from "./evm/prefix0x.ts";
import { sendPopulatedTransaction } from "./evm/sender.ts";
import { buildSwapContractsForAsset } from "./evm/swapContracts.ts";
import { type ClaimResult, claimAsset } from "./evm/transaction.ts";
import type { Signer } from "./interfaces/signer.ts";
import { AssetKind, GasAbstractionType } from "./types.ts";
import type { ECKeys, UtxoAsset } from "./utxo/index.ts";

export type UtxoClaimKeys = {
    claimKeys: ECKeys;
    // Net amount (in sats) to deliver to the claim address; the gap to the
    // gross lockup (`claimDetails.amount`) funds the claim transaction fee,
    // typically the chain pair's `minerFees.user.claim`.
    receiveAmount: number;
    blindingKey?: string;
    cooperativeSource?: {
        asset: UtxoAsset;
        refundKeys: ECKeys;
    };
};

export type ChainSwapExecuteArgs<A extends string = string> = {
    createdSwap: ChainSwapCreatedResponse;
    to: A;
    preimage: string;
    claimAddress: string;
    destination?: string;
    signer?: Signer;
    utxoClaim?: UtxoClaimKeys;
};

export type ChainSwapExecuteResult = {
    claimTransactionId: string;
    receiveAmount?: bigint;
};

const claimEvmDestination = async (
    asset: string,
    preimage: string,
    claimAddressArg: string,
    destinationArg: string | undefined,
    signer: Signer,
    claimDetails: ChainSwapCreatedResponse["claimDetails"],
): Promise<ClaimResult> => {
    if (claimDetails.refundAddress === undefined) {
        throw new Error(
            `chain swap claim details for ${asset} are missing a refundAddress`,
        );
    }
    const claimAddress = getAddress(
        claimDetails.claimAddress ?? claimAddressArg,
    );
    const destination = getAddress(destinationArg ?? claimAddress);
    const { etherSwap, erc20Swap } = await buildSwapContractsForAsset(
        asset,
        signer,
    );

    return claimAsset({
        gasAbstraction: GasAbstractionType.Signer,
        asset,
        preimage,
        amount: claimDetails.amount,
        claimAddress,
        refundAddress: getAddress(claimDetails.refundAddress),
        timeoutBlockHeight: claimDetails.timeoutBlockHeight,
        destination,
        getSigner: () => signer,
        gasAbstractionSigner: signer,
        etherSwap,
        erc20Swap,
        sendTransaction: sendPopulatedTransaction,
    });
};

const claimUtxoDestination = async (
    asset: string,
    claimAddress: string,
    preimage: string,
    utxoClaim: UtxoClaimKeys,
    createdSwap: ChainSwapCreatedResponse,
): Promise<ClaimResult> => {
    const { claimChainSwapUtxo } = await import("./utxo/claim.ts");

    const { serverLock } = await getChainSwapTransactions(createdSwap.id);
    const lockupTxHex = serverLock.transaction.hex;
    if (lockupTxHex === undefined) {
        throw new Error(
            `server lockup transaction for swap ${createdSwap.id} is unavailable`,
        );
    }

    const claimDetails = createdSwap.claimDetails;
    const receiveAmount = utxoClaim.receiveAmount;
    const result = await claimChainSwapUtxo({
        id: createdSwap.id,
        asset: asset as UtxoAsset,
        network: getConfiguredNetwork(),
        serverPublicKey: claimDetails.serverPublicKey,
        swapTree: claimDetails.swapTree as never,
        blindingKey: utxoClaim.blindingKey ?? claimDetails.blindingKey,
        claimKeys: utxoClaim.claimKeys,
        preimage: hex.decode(stripHexPrefix(preimage)),
        claimAddress,
        receiveAmount,
        lockupTxHex,
        cooperativeSource:
            utxoClaim.cooperativeSource !== undefined
                ? {
                      asset: utxoClaim.cooperativeSource.asset,
                      refundKeys: utxoClaim.cooperativeSource.refundKeys,
                      sourceSwapTree: createdSwap.lockupDetails
                          .swapTree as never,
                  }
                : undefined,
    });

    await broadcastApiTransaction(asset, result.transactionHex);
    return {
        transactionHash: result.transactionId,
        receiveAmount: BigInt(receiveAmount),
    };
};

export const executeChainSwap = async <A extends string = string>(
    args: ChainSwapExecuteArgs<A>,
): Promise<ChainSwapExecuteResult> => {
    const {
        createdSwap,
        to,
        preimage,
        claimAddress,
        destination,
        signer,
        utxoClaim,
    } = args;

    // Only ERC20 destinations honor a `destination` distinct from `claimAddress`
    // (claim to `claimAddress`, then ERC20-transfer to `destination`). For
    // native-EVM and UTXO destinations the claim pays `claimAddress` directly
    // and `destination` is unused, so reject a distinct value instead of
    // silently ignoring it.
    if (destination !== undefined && getKindForAsset(to) !== AssetKind.ERC20) {
        const sameAddress = isEvmAsset(to)
            ? isAddressEqual(getAddress(destination), getAddress(claimAddress))
            : destination === claimAddress;
        if (!sameAddress) {
            throw new Error(
                `execute: destination must be omitted or equal claimAddress ` +
                    `for ${to} (${getKindForAsset(to)}); forwarding to a ` +
                    `distinct destination is only supported for ERC20 assets`,
            );
        }
    }

    let claim: ClaimResult;
    if (isEvmAsset(to)) {
        if (signer === undefined) {
            throw new Error(
                `execute: EVM destination "${to}" requires a signer`,
            );
        }
        claim = await claimEvmDestination(
            to,
            preimage,
            claimAddress,
            destination,
            signer,
            createdSwap.claimDetails,
        );
    } else {
        if (utxoClaim === undefined) {
            throw new Error(
                `execute: UTXO destination "${to}" requires utxoClaim keys`,
            );
        }
        claim = await claimUtxoDestination(
            to,
            claimAddress,
            preimage,
            utxoClaim,
            createdSwap,
        );
    }

    return {
        claimTransactionId: claim.transactionHash,
        receiveAmount: claim.receiveAmount,
    };
};
