import type { Network, Transaction } from "bitcoinjs-lib";
import type { Taptree } from "bitcoinjs-lib/src/types";
import type { RefundDetails } from "boltz-core";
import { Musig, TaprootUtils } from "boltz-core";
import type { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import { TaprootUtils as LiquidTaprootUtils } from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import { randomBytes } from "crypto";
import type { ECPairInterface } from "ecpair";
import { type Transaction as LiquidTransaction } from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "../../consts/Assets";
import secp from "../../lazy/secp";
import type { TransactionInterface } from "../boltzClient";

export const createMusig = async (
    ourKeys: ECPairInterface,
    theirPublicKey: Buffer,
) => {
    const { secpZkp } = await secp.get();
    return new Musig(secpZkp, ourKeys, randomBytes(32), [
        // The key of Boltz always comes first
        theirPublicKey,
        Buffer.from(ourKeys.publicKey),
    ]);
};

export const tweakMusig = (asset: string, musig: Musig, tree: Taptree) =>
    (asset === LBTC ? LiquidTaprootUtils : TaprootUtils).tweakMusig(
        musig,
        tree,
    );

export const hashForWitnessV1 = (
    asset: string,
    network: Network | LiquidNetwork,
    inputs: RefundDetails[] | LiquidRefundDetails[],
    tx: TransactionInterface,
    index: number,
    leafHash?: Buffer,
) => {
    if (asset === LBTC) {
        return LiquidTaprootUtils.hashForWitnessV1(
            network as LiquidNetwork,
            inputs as LiquidRefundDetails[],
            tx as LiquidTransaction,
            index,
            leafHash,
        );
    } else {
        return TaprootUtils.hashForWitnessV1(
            inputs as RefundDetails[],
            tx as Transaction,
            index,
            leafHash,
        );
    }
};
