import { hex } from "@scure/base";
import { SwapTreeSerializer } from "boltz-core";

import type { ECKeys } from "./ecpair";
import { createMusig, tweakMusig } from "./musig";
import type {
    CreatedChainSwap,
    CreatedSubmarineSwap,
} from "./swapCreator";

/**
 * Result of preparing a submarine cooperative claim signature.
 */
export type SubmarineClaimSignResult = {
    /** The user's MuSig2 public nonce. */
    publicNonce: Uint8Array;
    /** The user's partial Schnorr signature. */
    partialSignature: Uint8Array;
};

/**
 * Create the user's cooperative partial signature for a submarine swap claim.
 *
 * In a submarine swap, after the server claims the Lightning payment and reveals
 * the preimage, the user co-signs the on-chain claim transaction so Boltz can
 * broadcast it cooperatively (key-path spend, lower fees).
 *
 * @param swap - The submarine swap.
 * @param privateKey - The user's refund key pair (same key used for the swap).
 * @param serverClaimDetails - Data from `getSubmarineClaimDetails()`: Boltz's nonce, preimage, and transaction hash.
 * @returns The user's public nonce and partial signature for `postSubmarineClaimDetails()`.
 *
 * @example
 * ```ts
 * // 1. Server reveals claim details after settling the invoice
 * const claimDetails = await getSubmarineClaimDetails(swap.id);
 *
 * // 2. Verify the preimage matches the invoice hash (important!)
 * // ... your verification logic ...
 *
 * // 3. Create the user's partial signature
 * const { publicNonce, partialSignature } = createSubmarineClaimSignature(
 *     swap, refundKey, claimDetails,
 * );
 *
 * // 4. Send it to Boltz so they can broadcast the cooperative claim
 * await postSubmarineClaimDetails(swap.id, publicNonce, partialSignature);
 * ```
 */
export const createSubmarineClaimSignature = (
    swap: CreatedSubmarineSwap,
    privateKey: ECKeys,
    serverClaimDetails: {
        pubNonce: Uint8Array;
        preimage: Uint8Array;
        transactionHash: Uint8Array;
    },
): SubmarineClaimSignResult => {
    const boltzPublicKey = hex.decode(swap.claimPublicKey);
    const keyAgg = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweaked = tweakMusig(swap.assetSend, keyAgg, tree.tree);

    const withMsg = tweaked.message(serverClaimDetails.transactionHash);
    const withNonce = withMsg.generateNonce();

    const aggNonces = withNonce.aggregateNonces([
        [boltzPublicKey, serverClaimDetails.pubNonce],
    ]);
    const session = aggNonces.initializeSession();
    const signed = session.signPartial();

    return {
        publicNonce: withNonce.publicNonce,
        partialSignature: signed.ourPartialSignature,
    };
};

/**
 * Create the user's partial signature for a chain swap server-side claim.
 *
 * In a chain swap, the server needs the user to co-sign the server's claim
 * transaction on the lockup (send) side. This is the cooperative counterpart
 * where the user helps the server claim their locked funds.
 *
 * @param swap - The chain swap.
 * @param refundPrivateKey - The user's refund key pair (for the send/lockup side).
 * @param serverClaimDetails - Data from `getChainSwapClaimDetails()`: server's nonce, public key, and transaction hash.
 * @returns The user's public nonce and partial signature, or `undefined` if the claim data is invalid.
 *
 * @example
 * ```ts
 * const serverClaim = await getChainSwapClaimDetails(swap.id);
 * const sig = createChainSwapServerClaimSignature(swap, refundKey, serverClaim);
 * if (sig) {
 *     // Include in the postChainSwapDetails call
 * }
 * ```
 */
export const createChainSwapServerClaimSignature = (
    swap: CreatedChainSwap,
    refundPrivateKey: ECKeys,
    serverClaimDetails: {
        pubNonce: string;
        publicKey: string;
        transactionHash: string;
    },
): { pubNonce: string; partialSignature: string } => {
    const boltzClaimPublicKey = hex.decode(serverClaimDetails.publicKey);
    const keyAgg = createMusig(refundPrivateKey, boltzClaimPublicKey);
    const tweaked = tweakMusig(
        swap.assetSend,
        keyAgg,
        SwapTreeSerializer.deserializeSwapTree(swap.lockupDetails.swapTree).tree,
    );

    const withMsg = tweaked.message(
        hex.decode(serverClaimDetails.transactionHash),
    );
    const withNonce = withMsg.generateNonce();

    const aggNonces = withNonce.aggregateNonces([
        [boltzClaimPublicKey, hex.decode(serverClaimDetails.pubNonce)],
    ]);
    const session = aggNonces.initializeSession();
    const signed = session.signPartial();

    return {
        pubNonce: hex.encode(withNonce.publicNonce),
        partialSignature: hex.encode(signed.ourPartialSignature),
    };
};

