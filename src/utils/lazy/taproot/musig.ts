import { Network, Transaction } from "bitcoinjs-lib";
import { Taptree } from "bitcoinjs-lib/src/types";
import { Musig, RefundDetails, TaprootUtils } from "boltz-core";
import {
    LiquidRefundDetails,
    TaprootUtils as LiquidTaprootUtils,
} from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import { randomBytes } from "crypto";
import { ECPairInterface } from "ecpair";
import { Transaction as LiquidTransaction } from "liquidjs-lib";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { LBTC } from "../../../consts";
import { TransactionInterface } from "../boltzClient";
import { secp } from "../compat";

export const createMusig = (ourKeys: ECPairInterface, theirPublicKey: Buffer) =>
    new Musig(secp, ourKeys, randomBytes(32), [
        // The key of Boltz always comes first
        theirPublicKey,
        ourKeys.publicKey,
    ]);

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
