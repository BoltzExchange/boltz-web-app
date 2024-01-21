import { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";

import { fetcher } from "./helper";

type ReverseMinerFees = {
    lockup: number;
    claim: number;
};

type LegacyMinerFees = {
    normal: number;
    reverse: ReverseMinerFees;
};

type PairLimits = {
    minimal: number;
    maximal: number;
};

type PairType = {
    hash: string;
    rate: number;
};

type PairLegacy = PairType & {
    limits: PairLimits & {
        maximalZeroConf: {
            baseAsset: number;
            quoteAsset: number;
        };
    };
    fees: {
        percentage: number;
        percentageSwapIn: number;
        minerFees: {
            baseAsset: LegacyMinerFees;
            quoteAsset: LegacyMinerFees;
        };
    };
};

type SubmarinePairTypeTaproot = PairType & {
    limits: PairLimits & {
        maximalZeroConf: number;
    };
    fees: {
        percentage: number;
        minerFees: number;
    };
};

type ReversePairTypeTaproot = PairType & {
    limits: PairLimits;
    fees: {
        percentage: number;
        minerFees: ReverseMinerFees;
    };
};

type PairsLegacy = {
    info: string[];
    warnings: string[];
    pairs: Record<string, PairLegacy>;
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
    legacy: PairsLegacy;
    submarine: SubmarinePairsTaproot;
    reverse: ReversePairsTaproot;
};

type PartialSignature = {
    pubNonce: Buffer;
    signature: Buffer;
};

type TransactionInterface = Transaction | LiquidTransaction;

export const getPairs = async (asset: string): Promise<Pairs> => {
    const [legacy, submarine, reverse] = await Promise.all([
        fetcher<PairsLegacy>("/getpairs", asset),
        fetcher<SubmarinePairsTaproot>("/v2/swap/submarine", asset),
        fetcher<ReversePairsTaproot>("/v2/swap/reverse", asset),
    ]);

    return {
        legacy,
        reverse,
        submarine,
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
    PairLegacy,
    PartialSignature,
    TransactionInterface,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
};
