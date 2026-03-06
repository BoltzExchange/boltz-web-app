/**
 * High-level swap creation helpers.
 *
 * Each function calls the corresponding REST endpoint and returns a lean
 * {@link CreatedSubmarineSwap}, {@link CreatedReverseSwap}, or
 * {@link CreatedChainSwap} — exactly the data the SDK's claim / refund
 * helpers need, nothing more.
 *
 * @module
 */

import { createChainSwap, createReverseSwap, createSubmarineSwap } from "./client";
import { SwapType } from "./enums";
import type {
    CreatedChainSwap,
    CreatedReverseSwap,
    CreatedSubmarineSwap,
} from "./swapCreator";

/**
 * Create a submarine swap and return a lean object ready for claim / refund helpers.
 *
 * @param from - Source asset (on-chain, e.g. `"BTC"`).
 * @param to - Destination asset (Lightning, e.g. `"BTC"`).
 * @param invoice - BOLT-11 invoice to be paid via Lightning.
 * @param pairHash - Pair configuration hash from {@link import("./client").getPairs | getPairs}.
 * @param refundPublicKey - Hex-encoded refund public key (Taproot).
 * @returns A {@link CreatedSubmarineSwap} that can be passed directly to
 *          {@link import("./submarineClaim").createSubmarineClaimSignature | createSubmarineClaimSignature} or
 *          {@link import("./refund").buildRefundContext | buildRefundContext}.
 *
 * @example
 * ```ts
 * const swap = await setupSubmarineSwap("BTC", "BTC", invoice, pair.hash, pubKey);
 * // swap.id, swap.address, swap.expectedAmount, ... all available
 * // ready to pass to createSubmarineClaimSignature(swap, keys, claimDetails)
 * ```
 */
export const setupSubmarineSwap = async (
    from: string,
    to: string,
    invoice: string,
    pairHash: string,
    refundPublicKey?: string,
): Promise<CreatedSubmarineSwap> => {
    const response = await createSubmarineSwap(
        from,
        to,
        invoice,
        pairHash,
        refundPublicKey,
    );
    return {
        ...response,
        type: SwapType.Submarine,
        assetSend: from,
        assetReceive: to,
        invoice,
    };
};

/**
 * Create a reverse swap and return a lean object ready for claim helpers.
 *
 * @param from - Source asset (Lightning side, e.g. `"BTC"`).
 * @param to - Destination asset (on-chain, e.g. `"BTC"`, `"L-BTC"`).
 * @param invoiceAmount - Amount in satoshis for the generated invoice.
 * @param preimageHash - Hex-encoded SHA-256 hash of the preimage.
 * @param preimage - Hex-encoded preimage (stored in the returned object for claiming).
 * @param pairHash - Pair configuration hash.
 * @param claimPublicKey - Hex-encoded claim public key (Taproot).
 * @param claimAddress - On-chain address where claimed funds should be sent.
 * @returns A {@link CreatedReverseSwap} that can be passed directly to
 *          {@link import("./claim").buildReverseClaimContext | buildReverseClaimContext}.
 *
 * @example
 * ```ts
 * const swap = await setupReverseSwap(
 *     "BTC", "BTC", 50000,
 *     preimageHash, preimage,
 *     pair.hash, claimPubKey, myAddress,
 * );
 * const ctx = buildReverseClaimContext(swap, claimKeys, lockupTxHex);
 * ```
 */
export const setupReverseSwap = async (
    from: string,
    to: string,
    invoiceAmount: number,
    preimageHash: string,
    preimage: string,
    pairHash: string,
    claimPublicKey: string,
    claimAddress: string,
): Promise<CreatedReverseSwap> => {
    const response = await createReverseSwap(
        from,
        to,
        invoiceAmount,
        preimageHash,
        pairHash,
        claimPublicKey,
        claimAddress,
    );
    return {
        ...response,
        type: SwapType.Reverse,
        assetSend: from,
        assetReceive: to,
        preimage,
        claimAddress,
    };
};

/**
 * Create a chain swap and return a lean object ready for claim / refund helpers.
 *
 * @param from - Source chain asset (e.g. `"L-BTC"`).
 * @param to - Destination chain asset (e.g. `"BTC"`).
 * @param userLockAmount - Amount the user will lock (sats), or `undefined` for server-determined.
 * @param preimageHash - Hex-encoded SHA-256 hash of the preimage.
 * @param preimage - Hex-encoded preimage.
 * @param claimPublicKey - Hex-encoded claim public key for the destination chain.
 * @param refundPublicKey - Hex-encoded refund public key for the source chain.
 * @param pairHash - Pair configuration hash.
 * @param claimAddress - On-chain address to claim funds to (defaults to the server's claim lockup address).
 * @returns A {@link CreatedChainSwap} that can be passed directly to
 *          {@link import("./claim").buildChainClaimContext | buildChainClaimContext} or
 *          {@link import("./refund").buildRefundContext | buildRefundContext}.
 *
 * @example
 * ```ts
 * const swap = await setupChainSwap(
 *     "L-BTC", "BTC", 100000,
 *     preimageHash, preimage,
 *     claimPubKey, refundPubKey,
 *     pair.hash,
 * );
 * ```
 */
export const setupChainSwap = async (
    from: string,
    to: string,
    userLockAmount: number | undefined,
    preimageHash: string,
    preimage: string,
    claimPublicKey: string,
    refundPublicKey: string,
    pairHash: string,
    claimAddress?: string,
): Promise<CreatedChainSwap> => {
    const response = await createChainSwap(
        from,
        to,
        userLockAmount,
        preimageHash,
        claimPublicKey,
        refundPublicKey,
        claimAddress,
        pairHash,
    );
    return {
        ...response,
        type: SwapType.Chain,
        assetSend: from,
        assetReceive: to,
        preimage,
        claimAddress: claimAddress ?? response.claimDetails.lockupAddress,
    };
};

