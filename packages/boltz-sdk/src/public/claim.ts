import { hex } from "@scure/base";
import type { ClaimDetails } from "boltz-core";
import { OutputType, SwapTreeSerializer, detectSwap } from "boltz-core";
import type { LiquidClaimDetails } from "boltz-core/dist/lib/liquid";
import type { Buffer } from "buffer";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "./assets";
import {
    type DecodedAddress,
    type TransactionInterface,
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getTransaction,
    setCooperativeWitness,
    txToId,
} from "./compat";
import type { ECKeys } from "./ecpair";
import { parseBlindingKey } from "./keys";
import { createMusig, hashForWitnessV1, tweakMusig } from "./musig";
import type { CreatedChainSwap, CreatedReverseSwap } from "./swapCreator";
import { getRelevantAssetForSwap } from "./swapCreator";

/** Internal claim details structure used across claim operations. */
export type ClaimContext = {
    /** The swap being claimed. */
    swap: CreatedReverseSwap | CreatedChainSwap;
    /** The relevant on-chain asset. */
    asset: string;
    /** The user's secp256k1 key pair. */
    privateKey: ECKeys;
    /** Boltz's public key for this side of the swap (raw bytes). */
    boltzPublicKey: Uint8Array;
    /** Decoded destination address (script + optional blinding key). */
    decodedAddress: DecodedAddress;
    /** Constructed claim details array for boltz-core. */
    details: (ClaimDetails & { blindingPrivateKey?: Uint8Array })[];
    /** The MuSig2 key aggregation tweaked with the swap tree. */
    tweakedMusig: ReturnType<typeof tweakMusig>;
};

/**
 * Build the claim context for a reverse swap.
 *
 * Parses the lockup transaction, detects the swap output, deserializes the
 * swap tree, and prepares all the data structures needed to construct a
 * claim transaction.
 *
 * @param swap - The reverse swap to claim.
 * @param privateKey - The user's claim key pair.
 * @param lockupTxHex - Hex-encoded lockup transaction from the API.
 * @returns A {@link ClaimContext} ready for {@link buildClaimTransaction} and {@link cooperativeClaimSign}.
 */
export const buildReverseClaimContext = (
    swap: CreatedReverseSwap,
    privateKey: ECKeys,
    lockupTxHex: string,
): ClaimContext => {
    const asset = getRelevantAssetForSwap(swap);
    const lockupTx = getTransaction(asset).fromHex(lockupTxHex);
    const preimage = hex.decode(swap.preimage);
    const decodedAddress = decodeAddress(asset, swap.claimAddress);

    if (!swap.refundPublicKey) {
        throw new Error("Reverse swap is missing Boltz's refund public key");
    }
    const boltzPublicKey = hex.decode(swap.refundPublicKey);
    const keyAgg = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweaked = tweakMusig(asset, keyAgg, tree.tree);
    const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);

    if (swapOutput === undefined) {
        throw new Error("Could not detect swap output in lockup transaction");
    }

    const details = [
        {
            ...swapOutput,
            cooperative: true,
            swapTree: tree,
            privateKey: privateKey.privateKey,
            preimage,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey: parseBlindingKey(swap, false),
            internalKey: keyAgg.aggPubkey,
        },
    ] as unknown as (ClaimDetails & { blindingPrivateKey: Uint8Array })[];

    return {
        swap,
        asset,
        privateKey,
        boltzPublicKey,
        decodedAddress,
        details,
        tweakedMusig: tweaked,
    };
};

/**
 * Build the claim context for a chain swap.
 *
 * Parses the server's lockup transaction on the claim side, detects the
 * swap output, and prepares all data structures for claiming.
 *
 * @param swap - The chain swap to claim.
 * @param privateKey - The user's claim key pair.
 * @param serverLockupTxHex - Hex-encoded server lockup transaction.
 * @returns A {@link ClaimContext} ready for {@link buildClaimTransaction} and {@link cooperativeClaimSign}.
 */
export const buildChainClaimContext = (
    swap: CreatedChainSwap,
    privateKey: ECKeys,
    serverLockupTxHex: string,
): ClaimContext => {
    const asset = swap.assetReceive;
    const lockupTx = getTransaction(asset).fromHex(serverLockupTxHex);
    const boltzPublicKey = hex.decode(swap.claimDetails.serverPublicKey);
    const claimPrivateKey = privateKey;
    const keyAgg = createMusig(claimPrivateKey, boltzPublicKey);
    const claimTree = SwapTreeSerializer.deserializeSwapTree(
        swap.claimDetails.swapTree,
    );
    const tweaked = tweakMusig(asset, keyAgg, claimTree.tree);
    const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);

    if (swapOutput === undefined) {
        throw new Error(
            "Could not detect swap output in server lockup transaction",
        );
    }

    const decodedAddress = decodeAddress(asset, swap.claimAddress);

    const details = [
        {
            ...swapOutput,
            cooperative: true,
            swapTree: claimTree,
            privateKey: claimPrivateKey.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey: parseBlindingKey(swap, false),
            internalKey: keyAgg.aggPubkey,
            preimage: hex.decode(swap.preimage),
        },
    ] as unknown as (ClaimDetails & { blindingPrivateKey: Uint8Array })[];

    return {
        swap,
        asset,
        privateKey: claimPrivateKey,
        boltzPublicKey,
        decodedAddress,
        details,
        tweakedMusig: tweaked,
    };
};

/**
 * Build an unsigned claim transaction from a claim context.
 *
 * Uses the claim details and destination address from the context to
 * construct the transaction. The fee is calculated as the difference
 * between the input sum and the expected receive amount.
 *
 * @param ctx - The claim context from {@link buildReverseClaimContext} or {@link buildChainClaimContext}.
 * @param feeBudget - Maximum fee in satoshis for the claim transaction.
 * @returns The unsigned claim transaction.
 */
export const buildClaimTransaction = (
    ctx: ClaimContext,
    feeBudget: number,
): TransactionInterface => {
    const constructClaimTransaction = getConstructClaimTransaction(ctx.asset);

    return constructClaimTransaction(
        ctx.details as ClaimDetails[] | LiquidClaimDetails[],
        ctx.decodedAddress.script,
        feeBudget,
        true,
        ctx.asset === LBTC
            ? (getNetwork(ctx.asset) as LiquidNetwork)
            : undefined,
        ctx.decodedAddress.blindingKey as Buffer | undefined,
    );
};

/**
 * Result of a cooperative MuSig2 signing session.
 */
export type CooperativeSignResult = {
    /** The user's MuSig2 public nonce. */
    publicNonce: Uint8Array;
    /** The sighash that was signed. */
    sigHash: Uint8Array;
    /** Callback to finalize signing with Boltz's partial signature. */
    finalize: (boltzPartialSig: {
        pubNonce: Uint8Array;
        signature: Uint8Array;
    }) => TransactionInterface;
};

/**
 * Prepare a cooperative MuSig2 signing session for a claim transaction.
 *
 * Computes the sighash, generates a nonce, and returns a `finalize` callback
 * that the caller uses after receiving Boltz's partial signature.
 *
 * This design gives the caller full control: they decide how to request
 * Boltz's partial signature (via which API call) and when to finalize.
 *
 * @param ctx - The claim context.
 * @param claimTx - The unsigned claim transaction from {@link buildClaimTransaction}.
 * @param inputIndex - The input index to sign (usually `0`).
 * @returns A {@link CooperativeSignResult} with the nonce and finalize callback.
 *
 * @example
 * ```ts
 * const ctx = buildReverseClaimContext(swap, privateKey, lockupTxHex);
 * const claimTx = buildClaimTransaction(ctx, feeBudget);
 * const session = prepareCooperativeSign(ctx, claimTx, 0);
 *
 * // Request Boltz's partial signature via the API
 * const boltzSig = await getPartialReverseClaimSignature(
 *     swap.id, preimage, session.publicNonce, txToHex(claimTx), 0,
 * );
 *
 * // Finalize: aggregate signatures and set the witness
 * const signedTx = session.finalize(boltzSig);
 * ```
 */
export const prepareCooperativeSign = (
    ctx: ClaimContext,
    claimTx: TransactionInterface,
    inputIndex: number,
): CooperativeSignResult => {
    const sigHash = hashForWitnessV1(
        ctx.asset,
        getNetwork(ctx.asset),
        ctx.details,
        claimTx,
        inputIndex,
    );

    const withMsg = ctx.tweakedMusig.message(sigHash);
    const withNonce = withMsg.generateNonce();

    return {
        publicNonce: withNonce.publicNonce,
        sigHash,
        finalize: (boltzPartialSig) => {
            const aggNonces = withNonce.aggregateNonces([
                [ctx.boltzPublicKey, boltzPartialSig.pubNonce],
            ]);
            const session = aggNonces.initializeSession();
            const signed = session.signPartial();
            const withBoltz = signed.addPartial(
                ctx.boltzPublicKey,
                boltzPartialSig.signature,
            );

            setCooperativeWitness(
                claimTx,
                inputIndex,
                withBoltz.aggregatePartials(),
            );

            return claimTx;
        },
    };
};

/**
 * Set a claim transaction to non-cooperative mode.
 *
 * Modifies the claim details in-place so that boltz-core will produce a
 * script-path (non-cooperative) witness instead of a key-path witness.
 *
 * @param ctx - The claim context (will be mutated).
 */
export const setNonCooperative = (ctx: ClaimContext): void => {
    for (const detail of ctx.details) {
        (detail as unknown as { cooperative: boolean }).cooperative = false;
    }
};
