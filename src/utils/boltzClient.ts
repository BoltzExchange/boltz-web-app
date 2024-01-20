import { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";

import { fetcher } from "./helper";

type ReverseMinerFees = {
    lockup: number;
    claim: number;
};

type PairLimits = {
    minimal: number;
    maximal: number;
};

type PairTypeTaproot = {
    hash: string;
    rate: number;
};

type SubmarinePairTypeTaproot = PairTypeTaproot & {
    limits: PairLimits & {
        maximalZeroConf: number;
    };
    fees: {
        percentage: number;
        minerFees: number;
    };
};

type ReversePairTypeTaproot = PairTypeTaproot & {
    limits: PairLimits;
    fees: {
        percentage: number;
        minerFees: ReverseMinerFees;
    };
};

type SubmarinePairsTaproot = Record<
    string,
    Record<string, SubmarinePairTypeTaproot>
>;

type ReversePairsTaproot = Record<
    string,
    Record<string, ReversePairTypeTaproot>
>;

type Pairs = {
    submarine: SubmarinePairsTaproot;
    reverse: ReversePairsTaproot;
};

type PartialSignature = {
    pubNonce: Buffer;
    signature: Buffer;
};

type TransactionInterface = Transaction | LiquidTransaction;

export const getPairs = async (asset: string): Promise<Pairs> => {
    const [submarine, reverse] = await Promise.all([
        fetcher<SubmarinePairsTaproot>("/v2/swap/submarine", asset),
        fetcher<ReversePairsTaproot>("/v2/swap/reverse", asset),
    ]);

    return {
        submarine,
        reverse,
    };
};

export const getPartialRefundSignature = async (
    asset: string,
    id: string,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    const res = await fetcher("/v2/swap/submarine/refund", asset, {
        id,
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
    const res = await fetcher("/v2/swap/reverse/claim", asset, {
        id,
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

export {
    Pairs,
    PartialSignature,
    TransactionInterface,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
};
