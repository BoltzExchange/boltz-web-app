import { hex } from "@scure/base";
import { Buffer } from "buffer";

import type { ECKeys } from "./ecpair";
import { ECPair } from "./ecpair";
import { SwapType } from "./enums";
import type {
    CreatedChainSwap,
    CreatedReverseSwap,
    CreatedSubmarineSwap,
    CreatedSwap,
    SomeSwap,
} from "./swapCreator";

/**
 * Extract the Liquid blinding key from a swap.
 *
 * For chain swaps, selects the correct blinding key based on whether
 * this is a refund (lockup side) or claim (claim side).
 *
 * Accepts both lean {@link CreatedSwap} and full {@link SomeSwap} types.
 *
 * @param swap - The swap to extract the blinding key from.
 * @param isRefund - Whether this is for the refund side (`true`) or claim side (`false`).
 * @returns The blinding private key as a Buffer, or `undefined` if not applicable.
 */
export const parseBlindingKey = (
    swap: SomeSwap | CreatedSwap,
    isRefund: boolean,
): Buffer | undefined => {
    let blindingKey: string | undefined;

    switch (swap.type) {
        case SwapType.Chain:
            if (isRefund) {
                blindingKey = (swap as CreatedChainSwap).lockupDetails
                    .blindingKey;
            } else {
                blindingKey = (swap as CreatedChainSwap).claimDetails
                    .blindingKey;
            }
            break;
        default:
            blindingKey = (
                swap as CreatedSubmarineSwap | CreatedReverseSwap
            ).blindingKey;
    }

    return blindingKey ? Buffer.from(blindingKey, "hex") : undefined;
};

/**
 * Resolve a private key from either an HD key index or a raw hex/WIF string.
 *
 * When `keyIndex` is present, uses the `deriveKey` callback to derive the key
 * from the rescue file. Otherwise, attempts to decode `privateKeyHex` first as
 * hex, then as WIF.
 *
 * @param deriveKey - Callback that derives a key from an index.
 * @param keyIndex - HD key derivation index (preferred).
 * @param privateKeyHex - Raw private key as hex or WIF (fallback for legacy swaps).
 * @returns The resolved secp256k1 key pair.
 * @throws When neither `keyIndex` nor `privateKeyHex` yields a valid key.
 */
export const resolvePrivateKey = (
    deriveKey: (index: number) => ECKeys,
    keyIndex?: number,
    privateKeyHex?: string,
): ECKeys => {
    if (keyIndex !== undefined) {
        return deriveKey(keyIndex);
    }

    if (!privateKeyHex) {
        throw new Error("No key index or private key provided");
    }

    try {
        return ECPair.fromPrivateKey(hex.decode(privateKeyHex));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        // When the private key is not HEX, we try to decode it as WIF
        return ECPair.fromWIF(privateKeyHex);
    }
};

