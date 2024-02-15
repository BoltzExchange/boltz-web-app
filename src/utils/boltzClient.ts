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

type Contracts = {
    network: {
        chainId: number;
    };
    tokens: Record<string, string>;
    swapContracts: {
        EtherSwap: string;
        ERC20Swap: string;
    };
};

type NodeInfo = {
    publicKey: string;
    uris: string[];
};

type TransactionInterface = Transaction | LiquidTransaction;

export const getPairs = async (asset: string): Promise<Pairs> => {
    const [submarine, reverse] = await Promise.all([
        fetcher<SubmarinePairsTaproot>("/v2/swap/submarine", asset),
        fetcher<ReversePairsTaproot>("/v2/swap/reverse", asset),
    ]);

    return {
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

export const getNodes = (asset: string) =>
    fetcher<{
        BTC: {
            LND: NodeInfo;
            CLN: NodeInfo;
        };
    }>("/v2/nodes", asset);

export const getNodeStats = (asset: string) =>
    fetcher<{
        BTC: {
            total: {
                capacity: number;
                channels: number;
                peers: number;
                oldestChannel: number;
            };
        };
    }>("/v2/nodes/stats", asset);

export const getContracts = (asset: string) =>
    fetcher<Record<string, Contracts>>("/v2/chain/contracts", asset);

export const broadcastTransaction = (asset: string, txHex: string) =>
    fetcher<{ id: string }>(`/v2/chain/${asset}/transaction`, asset, {
        hex: txHex,
    });

export const getSubmarineTransaction = (asset: string, id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
        timeoutEta?: number;
    }>(`/v2/swap/submarine/${id}/transaction`, asset);

export const getReverseTransaction = (asset: string, id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
    }>(`/v2/swap/reverse/${id}/transaction`, asset);

export const getSwapStatus = (asset: string, id: string) =>
    fetcher<{
        status: string;
        failureReason?: string;
        zeroConfRejected?: boolean;
        transaction?: {
            id: string;
            hex: string;
        };
    }>(`/v2/swap/${id}`, asset);

export {
    Pairs,
    Contracts,
    PairLegacy,
    PartialSignature,
    TransactionInterface,
    ReversePairTypeTaproot,
    SubmarinePairTypeTaproot,
};
