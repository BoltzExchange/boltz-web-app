import type {
    ChainSwapCreatedResponse,
    ReverseCreatedResponse,
    SubmarineCreatedResponse,
} from "./apiTypes";
import { RBTC } from "./assets";
import { SwapType } from "./enums";

// ---------------------------------------------------------------------------
// Lean "created" types — only what SDK helpers need for claim / refund
// ---------------------------------------------------------------------------

/**
 * Minimal submarine swap data returned by {@link setupSubmarineSwap}.
 *
 * Contains the API response plus the few user-supplied fields that the
 * claim and refund helpers actually consume.  No display-only or
 * web-app-specific bookkeeping fields.
 */
export type CreatedSubmarineSwap = SubmarineCreatedResponse & {
    type: SwapType;
    assetSend: string;
    assetReceive: string;
    invoice: string;
};

/**
 * Minimal reverse swap data returned by {@link setupReverseSwap}.
 */
export type CreatedReverseSwap = ReverseCreatedResponse & {
    type: SwapType;
    assetSend: string;
    assetReceive: string;
    preimage: string;
    claimAddress: string;
};

/**
 * Minimal chain swap data returned by {@link setupChainSwap}.
 */
export type CreatedChainSwap = ChainSwapCreatedResponse & {
    type: SwapType;
    assetSend: string;
    assetReceive: string;
    preimage: string;
    claimAddress: string;
};

/** Union of all lean created-swap types. */
export type CreatedSwap =
    | CreatedSubmarineSwap
    | CreatedReverseSwap
    | CreatedChainSwap;

// ---------------------------------------------------------------------------
// Full swap types — used by the web app for storage and display
// ---------------------------------------------------------------------------

/** Properties shared by all swap types. */
export type SwapBase = {
    /** Swap direction. */
    type: SwapType;
    /** Current swap status string. */
    status?: string;
    /** Asset the user sends. */
    assetSend: string;
    /** Asset the user receives. */
    assetReceive: string;
    /** Amount in satoshis the user sends. */
    sendAmount: number;
    /** Amount in satoshis the user receives. */
    receiveAmount: number;
    /** Script output type version (e.g. Taproot = 2). */
    version: number;
    /** UNIX timestamp (milliseconds) when the swap was created. */
    date: number;
    /** Claim transaction ID, set after broadcast. */
    claimTx?: string;
    /** Lockup transaction ID, set after detection. */
    lockupTx?: string;
    useRif: boolean;
    signer?: string;
    // Set for hardware wallet signers
    derivationPath?: string;

    // Original user input (Lightning address/LNURL/BIP353/BOLT12) before resolution
    originalDestination?: string;
};

/**
 * A submarine swap (on-chain → Lightning).
 *
 * Combines the API creation response with client-side data needed to
 * complete or refund the swap.
 */
export type SubmarineSwap = SwapBase &
    SubmarineCreatedResponse & {
        /** BOLT-11 invoice to be paid via Lightning. */
        invoice: string;
        /** Preimage revealed after successful payment. */
        preimage?: string;
        /** HD key index for deriving the refund private key. */
        refundPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility with old storage format
        refundPrivateKey?: string;
    };

/**
 * A reverse swap (Lightning → on-chain).
 *
 * Combines the API creation response with client-side data needed to
 * claim funds on-chain.
 */
export type ReverseSwap = SwapBase &
    ReverseCreatedResponse & {
        /** User-generated preimage (hex). */
        preimage: string;
        /** On-chain address to claim funds to. */
        claimAddress: string;
        /** HD key index for deriving the claim private key. */
        claimPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility with old storage format
        claimPrivateKey?: string;
    };

/**
 * A chain swap (on-chain → on-chain).
 *
 * Combines the API creation response with client-side data needed to
 * claim and/or refund the swap.
 */
export type ChainSwap = SwapBase &
    ChainSwapCreatedResponse & {
        /** User-generated preimage (hex). */
        preimage: string;
        /** On-chain address to claim funds to. */
        claimAddress: string;
        /** HD key index for deriving the claim private key. */
        claimPrivateKeyIndex?: number;
        /** HD key index for deriving the refund private key. */
        refundPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility with old storage format
        claimPrivateKey?: string;
        refundPrivateKey?: string;
    };

/** Union of all swap types. */
export type SomeSwap = SubmarineSwap | ReverseSwap | ChainSwap;

/**
 * Get the on-chain asset that is relevant for transaction handling.
 *
 * - For submarine swaps this is the send asset (user locks on-chain).
 * - For reverse and chain swaps this is the receive asset (user claims on-chain).
 *
 * Accepts both lean {@link CreatedSwap} and full {@link SomeSwap} types.
 *
 * @param swap - The swap to inspect.
 * @returns The relevant asset identifier.
 */
export const getRelevantAssetForSwap = (
    swap: Pick<SwapBase, "type" | "assetSend" | "assetReceive">,
) => {
    switch (swap.type) {
        case SwapType.Submarine:
            return swap.assetSend;

        default:
            return swap.assetReceive;
    }
};

/**
 * Check whether a swap operates on the Rootstock (RSK) chain.
 *
 * Accepts both lean {@link CreatedSwap} and full {@link SomeSwap} types.
 *
 * @param swap - The swap to check.
 * @returns `true` if the relevant asset is RBTC.
 */
export const isRsk = (
    swap: Pick<SwapBase, "type" | "assetSend" | "assetReceive">,
) => getRelevantAssetForSwap(swap) === RBTC;
