import { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";

import { fetcher } from "../boltzApi";
import type { Pairs, PartialSignature } from "../types";

type TransactionInterface = Transaction | LiquidTransaction;

export const getPartialRefundSignature = async (
    asset: string,
    id: string,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    const res = await fetcher(`/v2/swap/submarine/${id}/refund`, asset, {
        index,
        pubNonce: pubNonce.toString("hex"),
        transaction: transaction.toHex(),
    });
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        signature: Buffer.from(res.partialSignature, "hex"),
    };
};

export const getPartialReverseClaimSignature = async (
    asset: string,
    id: string,
    preimage: Buffer,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    const res = await fetcher(`/v2/swap/reverse/${id}/claim`, asset, {
        index,
        preimage: preimage.toString("hex"),
        pubNonce: pubNonce.toString("hex"),
        transaction: transaction.toHex(),
    });
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        signature: Buffer.from(res.partialSignature, "hex"),
    };
};

export const getSubmarineClaimDetails = async (asset: string, id: string) => {
    const res = await fetcher(`/v2/swap/submarine/${id}/claim`, asset);
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        preimage: Buffer.from(res.preimage, "hex"),
        transactionHash: Buffer.from(res.transactionHash, "hex"),
    };
};

export const postSubmarineClaimDetails = (
    asset: string,
    id: string,
    pubNonce: Buffer | Uint8Array,
    partialSignature: Buffer | Uint8Array,
) =>
    fetcher(`/v2/swap/submarine/${id}/claim`, asset, {
        pubNonce: Buffer.from(pubNonce).toString("hex"),
        partialSignature: Buffer.from(partialSignature).toString("hex"),
    });

export const getSubmarineEipSignature = (asset: string, id: string) =>
    fetcher<{ signature: string }>(`/v2/swap/submarine/${id}/refund`, asset);

export const getFeeEstimations = (asset: string) =>
    fetcher<Record<string, number>>("/v2/chain/fees", asset);

export const broadcastTransaction = (asset: string, txHex: string) =>
    fetcher<{ id: string }>(`/v2/chain/${asset}/transaction`, asset, {
        hex: txHex,
    });

export { Pairs, PartialSignature, TransactionInterface };
