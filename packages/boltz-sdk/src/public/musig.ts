import type { Transaction as BtcTransaction } from "@scure/btc-signer";
import { SigHash } from "@scure/btc-signer";
import type { BTC_NETWORK } from "@scure/btc-signer/utils.js";
import { Musig, TaprootUtils, type Types } from "boltz-core";
import { TaprootUtils as LiquidTaprootUtils } from "boltz-core/dist/lib/liquid";
import type { MusigKeyAgg } from "boltz-core/dist/lib/musig/Musig";
import type { Transaction as LiquidTransaction } from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "./assets";
import type { ECKeys } from "./ecpair";

export type { MusigKeyAgg };

/**
 * Create a MuSig2 key aggregation from a local key pair and Boltz's public key.
 *
 * The Boltz public key is always placed first in the key list so that the
 * aggregated key is deterministic regardless of who initiates the session.
 *
 * @param ourKeys - The local secp256k1 key pair.
 * @param theirPublicKey - Boltz's compressed public key.
 * @returns A MuSig2 key aggregation object.
 */
export const createMusig = (
    ourKeys: ECKeys,
    theirPublicKey: Uint8Array,
): MusigKeyAgg => {
    return Musig.create(new Uint8Array(ourKeys.privateKey), [
        // The key of Boltz always comes first
        theirPublicKey,
        new Uint8Array(ourKeys.publicKey),
    ]);
};

/**
 * Tweak a MuSig2 aggregated key with a Taproot script tree.
 *
 * Delegates to the appropriate `TaprootUtils` implementation based on the
 * asset (Liquid vs Bitcoin).
 *
 * @param asset - The asset identifier (e.g. `"BTC"` or `"L-BTC"`).
 * @param musig - The MuSig2 key aggregation to tweak.
 * @param tree - The Taproot script tree used for tweaking.
 * @returns The tweaked MuSig2 key aggregation.
 */
export const tweakMusig = (
    asset: string,
    musig: MusigKeyAgg,
    tree: Types.TapTree,
): MusigKeyAgg =>
    (asset === LBTC ? LiquidTaprootUtils : TaprootUtils).tweakMusig(
        musig,
        tree,
    );

/**
 * Compute the BIP-341 sighash for a Taproot (witness v1) input.
 *
 * Handles both Bitcoin and Liquid transactions transparently.
 *
 * @param asset - Asset identifier determining which sighash algorithm to use.
 * @param network - The network parameters.
 * @param inputs - Previous outputs being spent (scripts + amounts / confidential data).
 * @param tx - The unsigned transaction.
 * @param index - Input index being signed.
 * @param leafHash - Optional leaf hash when signing via a script-path spend.
 * @returns The sighash bytes to sign.
 */
export const hashForWitnessV1 = (
    asset: string,
    network: BTC_NETWORK | LiquidNetwork,
    inputs:
        | { script: Uint8Array; amount: bigint }[]
        | { script: Buffer; value: Buffer; asset: Buffer; nonce: Buffer }[],
    tx: BtcTransaction | LiquidTransaction,
    index: number,
    leafHash?: Buffer,
) => {
    if (asset === LBTC) {
        return LiquidTaprootUtils.hashForWitnessV1(
            network as LiquidNetwork,
            inputs as {
                script: Buffer;
                value: Buffer;
                asset: Buffer;
                nonce: Buffer;
            }[],
            tx as LiquidTransaction,
            index,
            leafHash,
        );
    } else {
        const btcTx = tx as BtcTransaction;
        return btcTx.preimageWitnessV1(
            index,
            (inputs as { script: Uint8Array; amount: bigint }[]).map(
                (i) => i.script,
            ),
            SigHash.DEFAULT,
            (inputs as { script: Uint8Array; amount: bigint }[]).map(
                (i) => i.amount,
            ),
        );
    }
};
