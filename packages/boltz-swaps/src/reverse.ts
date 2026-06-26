import { hex } from "@scure/base";
import { getAddress, isAddressEqual } from "viem";

import {
    type ReverseCreatedResponse,
    broadcastApiTransaction,
    getReverseTransaction,
} from "./client.ts";
import { getConfiguredNetwork, getKindForAsset, isEvmAsset } from "./config.ts";
import { stripHexPrefix } from "./evm/prefix0x.ts";
import { sendPopulatedTransaction } from "./evm/sender.ts";
import { buildSwapContractsForAsset } from "./evm/swapContracts.ts";
import { type ClaimResult, claimAsset } from "./evm/transaction.ts";
import type { Signer } from "./interfaces/signer.ts";
import { AssetKind, GasAbstractionType } from "./types.ts";
import type { ECKeys, UtxoAsset } from "./utxo/index.ts";

export type ReverseExecuteArgs<A extends string = string> = {
    createdSwap: ReverseCreatedResponse;
    to: A;
    preimage: string;
    // Net amount to the claim address; the gap to the gross lockup funds the fee.
    receiveAmount: number;
    claimAddress: string;
    claimKeys?: ECKeys;
    blindingKey?: string;
    signer?: Signer;
    destination?: string;
    cooperative?: boolean;
};

export type ReverseExecuteResult = {
    claimTransactionId: string;
    receiveAmount?: bigint;
};

const claimEvmReverse = async (
    asset: string,
    preimage: string,
    claimAddressArg: string,
    destinationArg: string | undefined,
    signer: Signer,
    createdSwap: ReverseCreatedResponse,
): Promise<ClaimResult> => {
    if (createdSwap.refundAddress === undefined) {
        throw new Error(
            `reverse swap ${createdSwap.id} is missing a refundAddress for an EVM claim`,
        );
    }
    const claimAddress = getAddress(claimAddressArg);
    const destination = getAddress(destinationArg ?? claimAddress);
    const { etherSwap, erc20Swap } = await buildSwapContractsForAsset(
        asset,
        signer,
    );

    return claimAsset({
        gasAbstraction: GasAbstractionType.Signer,
        asset,
        preimage,
        amount: createdSwap.onchainAmount,
        claimAddress,
        refundAddress: getAddress(createdSwap.refundAddress),
        timeoutBlockHeight: createdSwap.timeoutBlockHeight,
        destination,
        getSigner: () => signer,
        gasAbstractionSigner: signer,
        etherSwap,
        erc20Swap,
        sendTransaction: sendPopulatedTransaction,
    });
};

export const executeReverseSwap = async <A extends string = string>(
    args: ReverseExecuteArgs<A>,
): Promise<ReverseExecuteResult> => {
    const {
        createdSwap,
        to,
        preimage,
        receiveAmount,
        claimAddress,
        claimKeys,
        blindingKey,
        signer,
        destination,
        cooperative,
    } = args;

    // Only ERC20 claims forward to a distinct `destination`; native-EVM and
    // UTXO claims pay `claimAddress` directly, so reject rather than ignore.
    if (destination !== undefined && getKindForAsset(to) !== AssetKind.ERC20) {
        const sameAddress = isEvmAsset(to)
            ? isAddressEqual(getAddress(destination), getAddress(claimAddress))
            : destination === claimAddress;
        if (!sameAddress) {
            throw new Error(
                `executeReverseSwap: destination must be omitted or equal ` +
                    `claimAddress for ${to} (${getKindForAsset(to)}); ` +
                    `forwarding to a distinct destination is only supported ` +
                    `for ERC20 assets`,
            );
        }
    }

    if (isEvmAsset(to)) {
        if (signer === undefined) {
            throw new Error(
                `executeReverseSwap: EVM destination "${to}" requires a signer`,
            );
        }
        const claim = await claimEvmReverse(
            to,
            preimage,
            claimAddress,
            destination,
            signer,
            createdSwap,
        );
        return {
            claimTransactionId: claim.transactionHash,
            receiveAmount: claim.receiveAmount,
        };
    }

    if (claimKeys === undefined) {
        throw new Error(
            `executeReverseSwap: UTXO destination "${to}" requires claimKeys`,
        );
    }
    if (createdSwap.refundPublicKey === undefined) {
        throw new Error(
            `reverse swap ${createdSwap.id} is missing a refundPublicKey for a UTXO claim`,
        );
    }

    const { hex: lockupTxHex } = await getReverseTransaction(createdSwap.id);

    // Dynamic import keeps the optional UTXO peer deps out of the main entry.
    const { claimReverseUtxo } = await import("./utxo/claim.ts");
    const result = await claimReverseUtxo({
        id: createdSwap.id,
        asset: to as UtxoAsset,
        network: getConfiguredNetwork(),
        serverPublicKey: createdSwap.refundPublicKey,
        swapTree: createdSwap.swapTree as never,
        blindingKey: blindingKey ?? createdSwap.blindingKey,
        claimKeys,
        preimage: hex.decode(stripHexPrefix(preimage)),
        claimAddress,
        receiveAmount,
        lockupTxHex,
        cooperative,
    });

    await broadcastApiTransaction(to, result.transactionHex);
    return {
        claimTransactionId: result.transactionId,
        receiveAmount: BigInt(receiveAmount),
    };
};
