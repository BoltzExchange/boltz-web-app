import type {
    ChainSwapCreatedResponse,
    ReverseCreatedResponse,
    SubmarineCreatedResponse,
} from "./apiTypes";
import { LN, isEvmAsset } from "./assets";
import { SwapType } from "./enums";

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

/** Whether DEX hops run before or after the Boltz swap. */
export const enum HopsPosition {
    Before = "before",
    After = "after",
}

/** A single hop in a DEX route attached to a swap. */
export type EncodedHop = {
    type: SwapType;
    from: string;
    to: string;
    dexDetails?: {
        chain: string;
        tokenIn: string;
        tokenOut: string;
    };
};

/** DEX route metadata for routed swaps (e.g. USDT0 via TBTC). */
export type DexDetail = {
    hops: EncodedHop[];
    /** Whether hops run before or after the Boltz swap. */
    position: HopsPosition;
    /**
     * Expected DEX amount at creation; updated with actual amount after
     * execution. For hops after Boltz: expected output amount from the DEX.
     * For hops before Boltz: expected input amount to the DEX.
     */
    quoteAmount: number | string;
};

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
    useGasAbstraction: boolean;
    signer?: string;
    derivationPath?: string;
    originalDestination?: string;
    /** DEX route for routed swaps (e.g. USDT0 via TBTC). */
    dex?: DexDetail;
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
        magicRoutingHintSavedFees?: string;

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
 * Check whether a swap operates on an EVM chain.
 *
 * Accepts both lean {@link CreatedSwap} and full {@link SomeSwap} types.
 *
 * @param swap - The swap to check.
 * @returns `true` if the relevant asset is an EVM asset.
 */
export const isEvmSwap = (
    swap: Pick<SwapBase, "type" | "assetSend" | "assetReceive">,
) => isEvmAsset(getRelevantAssetForSwap(swap));

/**
 * Resolve the actual send asset, accounting for DEX hops.
 *
 * When a DEX hop runs *before* the Boltz swap, the user's real send asset
 * is the first hop's `from` (e.g. USDT0), not the Boltz swap's `assetSend`
 * (e.g. TBTC).
 *
 * @param swap - The swap to inspect.
 * @param coalesceLn - When `true`, returns `"LN"` for reverse swaps instead
 *   of the on-chain `assetSend`.
 */
export const getFinalAssetSend = (
    swap: Pick<SwapBase, "type" | "assetSend" | "dex">,
    coalesceLn: boolean = false,
): string => {
    if (
        swap.dex !== undefined &&
        swap.dex.position === HopsPosition.Before &&
        swap.dex.hops.length > 0
    ) {
        return swap.dex.hops[0].from;
    }

    return coalesceLn && swap.type === SwapType.Reverse ? LN : swap.assetSend;
};

/**
 * Resolve the actual receive asset, accounting for DEX hops.
 *
 * When a DEX hop runs *after* the Boltz swap, the user's real receive
 * asset is the last hop's `to` (e.g. USDT0), not the Boltz swap's
 * `assetReceive` (e.g. TBTC).
 *
 * @param swap - The swap to inspect.
 * @param coalesceLn - When `true`, returns `"LN"` for submarine swaps
 *   instead of the on-chain `assetReceive`.
 */
export const getFinalAssetReceive = (
    swap: Pick<SwapBase, "type" | "assetReceive" | "dex">,
    coalesceLn: boolean = false,
): string => {
    if (
        swap.dex !== undefined &&
        swap.dex.position === HopsPosition.After &&
        swap.dex.hops.length > 0
    ) {
        return swap.dex.hops[swap.dex.hops.length - 1].to;
    }

    return coalesceLn && swap.type === SwapType.Submarine
        ? LN
        : swap.assetReceive;
};
