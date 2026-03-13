import { hex } from "@scure/base";
import type { RefundDetails } from "boltz-core";
import { OutputType, SwapTreeSerializer, detectSwap } from "boltz-core";
import type { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import type { Buffer } from "buffer";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "./assets";
import {
    type DecodedAddress,
    type TransactionInterface,
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setCooperativeWitness,
    txToHex,
    txToId,
} from "./compat";
import type { ECKeys } from "./ecpair";
import { SwapType } from "./enums";
import { parseBlindingKey } from "./keys";
import { createMusig, hashForWitnessV1, tweakMusig } from "./musig";
import type { CreatedChainSwap, CreatedSubmarineSwap } from "./swapCreator";

/** Internal refund context structure used across refund operations. */
export type RefundContext = {
    /** The swap being refunded. */
    swap: CreatedSubmarineSwap | CreatedChainSwap;
    /** The send-side asset (chain being refunded from). */
    asset: string;
    /** The user's secp256k1 refund key pair. */
    privateKey: ECKeys;
    /** Boltz's public key for this side of the swap (raw bytes). */
    boltzPublicKey: Uint8Array;
    /** Decoded refund destination address. */
    decodedAddress: DecodedAddress;
    /** Constructed refund details array for boltz-core. */
    details: (RefundDetails & { blindingPrivateKey?: Uint8Array })[];
    /** The MuSig2 key aggregation tweaked with the swap tree. */
    tweakedMusig: ReturnType<typeof tweakMusig>;
};

/**
 * Build the refund context for a submarine or chain swap.
 *
 * Parses the lockup transaction(s), detects the swap outputs, deserializes
 * the swap tree, and prepares all data structures for constructing a refund
 * transaction.
 *
 * @param swap - The submarine or chain swap to refund.
 * @param privateKey - The user's refund key pair.
 * @param refundAddress - On-chain address to send refunded funds to.
 * @param lockupTxHexes - Hex-encoded lockup transaction(s).
 * @returns A {@link RefundContext} ready for {@link buildRefundTransaction} and {@link prepareCooperativeRefund}.
 */
export const buildRefundContext = (
    swap: CreatedSubmarineSwap | CreatedChainSwap,
    privateKey: ECKeys,
    refundAddress: string,
    lockupTxHexes: string[],
): RefundContext => {
    const asset = swap.assetSend;

    const theirPublicKey =
        swap.type === SwapType.Submarine
            ? (swap as CreatedSubmarineSwap).claimPublicKey
            : (swap as CreatedChainSwap).lockupDetails.serverPublicKey;
    const lockupTree =
        swap.type === SwapType.Submarine
            ? (swap as CreatedSubmarineSwap).swapTree
            : (swap as CreatedChainSwap).lockupDetails.swapTree;

    const swapTree = SwapTreeSerializer.deserializeSwapTree(lockupTree);
    const boltzPublicKey = hex.decode(theirPublicKey);
    const keyAgg = createMusig(privateKey, boltzPublicKey);
    const tweaked = tweakMusig(asset, keyAgg, swapTree.tree);

    const decodedAddress = decodeAddress(asset, refundAddress);

    const details = lockupTxHexes.map((txHex) => {
        const lockupTx = getTransaction(asset).fromHex(txHex);
        const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);

        if (swapOutput === undefined) {
            throw new Error(
                "Could not detect swap output in lockup transaction",
            );
        }

        return {
            ...swapOutput,
            cooperative: true,
            swapTree,
            privateKey: privateKey.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey: parseBlindingKey(swap, true),
            internalKey: keyAgg.aggPubkey,
        } as unknown as RefundDetails & { blindingPrivateKey: Uint8Array };
    });

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
 * Build an unsigned refund transaction from a refund context.
 *
 * Uses `targetFee` internally to find the correct fee for the transaction.
 *
 * @param ctx - The refund context from {@link buildRefundContext}.
 * @param timeoutBlockHeight - Block height for the HTLC timeout (nLockTime).
 * @param feePerVbyte - Fee rate in sat/vByte.
 * @returns The unsigned refund transaction.
 */
export const buildRefundTransaction = (
    ctx: RefundContext,
    timeoutBlockHeight: number,
    feePerVbyte: number,
): TransactionInterface => {
    const addOneSatBuffer =
        ctx.asset === LBTC && ctx.decodedAddress.blindingKey === undefined;

    const constructRefundTransaction = getConstructRefundTransaction(
        ctx.asset,
        addOneSatBuffer,
    );

    return constructRefundTransaction(
        ctx.details as RefundDetails[] | LiquidRefundDetails[],
        ctx.decodedAddress.script,
        timeoutBlockHeight,
        feePerVbyte,
        true,
        ctx.asset === LBTC
            ? (getNetwork(ctx.asset) as LiquidNetwork)
            : undefined,
        ctx.decodedAddress.blindingKey as Buffer | undefined,
    );
};

/**
 * Result of a cooperative MuSig2 refund signing session.
 */
export type CooperativeRefundResult = {
    /** The user's MuSig2 public nonce. */
    publicNonce: Uint8Array;
    /** The sighash that was signed. */
    sigHash: Uint8Array;
    /** Hex-encoded unsigned refund transaction (needed for the API call). */
    transactionHex: string;
    /** Callback to finalize signing with Boltz's partial signature. */
    finalize: (boltzPartialSig: {
        pubNonce: Uint8Array;
        signature: Uint8Array;
    }) => TransactionInterface;
};

/**
 * Prepare a cooperative MuSig2 signing session for a refund transaction.
 *
 * Computes the sighash, generates a nonce, and returns a `finalize` callback
 * that the caller uses after receiving Boltz's partial signature.
 *
 * @param ctx - The refund context.
 * @param refundTx - The unsigned refund transaction from {@link buildRefundTransaction}.
 * @param inputIndex - The input index to sign (usually `0`).
 * @returns A {@link CooperativeRefundResult} with the nonce, transaction hex, and finalize callback.
 *
 * @example
 * ```ts
 * const ctx = buildRefundContext(swap, privateKey, address, [lockupTxHex]);
 * const refundTx = buildRefundTransaction(ctx, timeoutBlockHeight, feePerVbyte);
 * const session = prepareCooperativeRefund(ctx, refundTx, 0);
 *
 * // Request Boltz's partial signature
 * const boltzSig = await getPartialRefundSignature(
 *     swap.id, swap.type, session.publicNonce, session.transactionHex, 0,
 * );
 *
 * // Finalize: aggregate signatures and set the witness
 * const signedTx = session.finalize(boltzSig);
 * ```
 */
export const prepareCooperativeRefund = (
    ctx: RefundContext,
    refundTx: TransactionInterface,
    inputIndex: number,
): CooperativeRefundResult => {
    const sigHash = hashForWitnessV1(
        ctx.asset,
        getNetwork(ctx.asset),
        ctx.details,
        refundTx,
        inputIndex,
    );

    const withMsg = ctx.tweakedMusig.message(sigHash);
    const withNonce = withMsg.generateNonce();

    return {
        publicNonce: withNonce.publicNonce,
        sigHash,
        transactionHex: txToHex(refundTx),
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
                refundTx,
                inputIndex,
                withBoltz.aggregatePartials(),
            );

            return refundTx;
        },
    };
};

/**
 * Set a refund context to non-cooperative mode.
 *
 * Modifies the refund details in-place so that boltz-core will produce a
 * script-path (non-cooperative) witness.
 *
 * @param ctx - The refund context (will be mutated).
 */
export const setRefundNonCooperative = (ctx: RefundContext): void => {
    for (const detail of ctx.details) {
        (detail as unknown as { cooperative: boolean }).cooperative = false;
    }
};

