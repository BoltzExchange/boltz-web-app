import type { Transaction as BtcTransaction } from "@scure/btc-signer";
import { SigHash } from "@scure/btc-signer";
import type { BTC_NETWORK } from "@scure/btc-signer/utils.js";
import { Musig, TaprootUtils, type Types } from "boltz-core";
import { TaprootUtils as LiquidTaprootUtils } from "boltz-core/dist/lib/liquid";
import type { MusigKeyAgg } from "boltz-core/dist/lib/musig/Musig";
import type { Transaction as LiquidTransaction } from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "../../consts/Assets";
import type { ECKeys } from "../ecpair";

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

export const tweakMusig = (
    asset: string,
    musig: MusigKeyAgg,
    tree: Types.TapTree,
): MusigKeyAgg =>
    (asset === LBTC ? LiquidTaprootUtils : TaprootUtils).tweakMusig(
        musig,
        tree,
    );

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
