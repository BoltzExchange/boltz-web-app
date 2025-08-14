import type { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import type { Transaction as LiquidTransaction } from "liquidjs-lib";
import log from "loglevel";

import { config } from "../config";
import { SwapType } from "../consts/Enums";
import { broadcastToExplorer } from "./blockchain";
import { fetcher } from "./helper";
import { validateInvoiceForOffer } from "./invoice";

const cooperativeErrorMessage = "cooperative signatures for swaps are disabled";
const checkCooperative = () => {
    if (config.cooperativeDisabled === true) {
        throw new Error(cooperativeErrorMessage);
    }
};

type ReverseMinerFees = {
    lockup: number;
    claim: number;
};

type PairLimits = {
    minimal: number;
    maximal: number;
};

type PairType = {
    hash: string;
    rate: number;
};

type SubmarinePairTypeTaproot = PairType & {
    limits: PairLimits & {
        maximalZeroConf: number;
        minimalBatched?: number;
    };
    fees: {
        minerFees: number;
        percentage: number;
        maximalRoutingFee?: number;
    };
};

type ReversePairTypeTaproot = PairType & {
    limits: PairLimits;
    fees: {
        percentage: number;
        minerFees: ReverseMinerFees;
    };
};

type ChainPairTypeTaproot = PairType & {
    limits: PairLimits & {
        maximalZeroConf: number;
    };
    fees: {
        percentage: number;
        minerFees: {
            server: number;
            user: {
                claim: number;
                lockup: number;
            };
        };
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

type ChainPairsTaproot = Record<string, Record<string, ChainPairTypeTaproot>>;

type Pairs = {
    [SwapType.Submarine]: SubmarinePairsTaproot;
    [SwapType.Reverse]: ReversePairsTaproot;
    [SwapType.Chain]: ChainPairsTaproot;
};

type PartialSignature = {
    pubNonce: Buffer;
    signature: Buffer;
};

type Contracts = {
    network: {
        name: string;
        chainId: number;
    };
    tokens: Record<string, string>;
    swapContracts: {
        EtherSwap: string;
        ERC20Swap: string;
    };
};

type SwapTreeLeaf = {
    output: string;
    version: number;
};

type SwapTree = {
    claimLeaf: SwapTreeLeaf;
    refundLeaf: SwapTreeLeaf;
};

type SubmarineCreatedResponse = {
    id: string;
    address: string;
    bip21: string;
    swapTree: SwapTree;
    acceptZeroConf: boolean;
    expectedAmount: number;
    claimPublicKey: string;
    timeoutBlockHeight: number;
    blindingKey?: string;
    claimAddress?: string;
};

type ReverseCreatedResponse = {
    id: string;
    invoice: string;
    swapTree: SwapTree;
    lockupAddress: string;
    timeoutBlockHeight: number;
    onchainAmount: number;
    refundPublicKey?: string;
    blindingKey?: string;
    refundAddress?: string;
};

type ChainSwapDetails = {
    swapTree: SwapTree;
    lockupAddress: string;
    serverPublicKey: string;
    timeoutBlockHeight: number;
    amount: number;
    blindingKey?: string;
    refundAddress?: string;
    claimAddress?: string;
    bip21?: string;
};

type ChainSwapCreatedResponse = {
    id: string;
    claimDetails: ChainSwapDetails;
    lockupDetails: ChainSwapDetails;
};

type ChainSwapTransaction = {
    transaction: {
        id: string;
        hex?: string;
    };
    timeout: {
        blockHeight: number;
        eta?: number;
    };
};

type TransactionInterface = Transaction | LiquidTransaction;

type RestorableSwapDetails = {
    tree: SwapTree;
    keyIndex: number;
    lockupAddress: string;
    serverPublicKey: string;
    timeoutBlockHeight: number;
    blindingKey?: string;
    amount?: number;
    transaction?: { id: string; vout: number };
    preimageHash?: string;
};

export type RestorableSwap = {
    id: string;
    type: SwapType;
    status: string;
    from: string;
    to: string;
    createdAt: number;
    claimPrivateKey?: string;
    claimDetails?: RestorableSwapDetails;
    refundDetails?: RestorableSwapDetails;
};

export type LockupTransaction = {
    id: string;
    hex: string;
    timeoutBlockHeight: number;
    timeoutEta?: number;
};

export type SwapStatus = {
    status: string;
    failureReason?: string;
    zeroConfRejected?: boolean;
    transaction?: {
        id: string;
        hex: string;
    };
};

export const getPairs = async (options?: RequestInit): Promise<Pairs> => {
    const [submarine, reverse, chain] = await Promise.all([
        fetcher<SubmarinePairsTaproot>("/v2/swap/submarine", null, options),
        fetcher<ReversePairsTaproot>("/v2/swap/reverse", null, options),
        fetcher<ChainPairsTaproot>("/v2/swap/chain", null, options),
    ]);

    return {
        [SwapType.Chain]: chain,
        [SwapType.Reverse]: reverse,
        [SwapType.Submarine]: submarine,
    };
};

export const fetchBolt12Invoice = async (
    offer: string,
    amountSat: number,
): Promise<{ invoice: string }> => {
    const res = await fetcher<{ invoice: string }>(
        "/v2/lightning/BTC/bolt12/fetch",
        {
            offer,
            amount: amountSat,
        },
    );
    await validateInvoiceForOffer(offer, res.invoice);

    return res;
};

export const fetchBip21Invoice = async (invoice: string) => {
    try {
        log.debug("Fetching BIP21 for invoice", invoice);
        const res = await fetcher<{ bip21: string; signature: string }>(
            `/v2/swap/reverse/${invoice}/bip21`,
        );
        return res;
    } catch {
        log.debug("No BIP21 found for invoice");
        return null;
    }
};

export const createSubmarineSwap = (
    from: string,
    to: string,
    invoice: string,
    pairHash: string,
    referralId: string,
    refundPublicKey?: string,
): Promise<SubmarineCreatedResponse> =>
    fetcher("/v2/swap/submarine", {
        from,
        to,
        invoice,
        refundPublicKey,
        pairHash,
        referralId,
    });

export const createReverseSwap = (
    from: string,
    to: string,
    invoiceAmount: number,
    preimageHash: string,
    pairHash: string,
    referralId: string,
    claimPublicKey?: string,
    claimAddress?: string,
): Promise<ReverseCreatedResponse> =>
    fetcher("/v2/swap/reverse", {
        from,
        to,
        invoiceAmount,
        preimageHash,
        claimPublicKey,
        claimAddress,
        referralId,
        pairHash,
    });

export const createChainSwap = (
    from: string,
    to: string,
    userLockAmount: number | undefined,
    preimageHash: string,
    claimPublicKey: string | undefined,
    refundPublicKey: string | undefined,
    claimAddress: string | undefined,
    pairHash: string,
    referralId: string,
): Promise<ChainSwapCreatedResponse> =>
    fetcher("/v2/swap/chain", {
        from,
        to,
        preimageHash,
        claimPublicKey,
        refundPublicKey,
        claimAddress,
        pairHash,
        referralId,
        userLockAmount,
    });

export const getPartialRefundSignature = async (
    id: string,
    type: SwapType,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher<{ pubNonce: string; partialSignature: string }>(
        `/v2/swap/${
            type === SwapType.Submarine ? "submarine" : "chain"
        }/${id}/refund`,
        {
            index,
            pubNonce: pubNonce.toString("hex"),
            transaction: transaction.toHex(),
        },
    );
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        signature: Buffer.from(res.partialSignature, "hex"),
    };
};

export const getPartialReverseClaimSignature = async (
    id: string,
    preimage: Buffer,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher<{ pubNonce: string; partialSignature: string }>(
        `/v2/swap/reverse/${id}/claim`,
        {
            index,
            preimage: preimage.toString("hex"),
            pubNonce: pubNonce.toString("hex"),
            transaction: transaction.toHex(),
        },
    );
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        signature: Buffer.from(res.partialSignature, "hex"),
    };
};

export const getSubmarineClaimDetails = async (id: string) => {
    const res = await fetcher<{
        pubNonce: string;
        preimage: string;
        transactionHash: string;
    }>(`/v2/swap/submarine/${id}/claim`);
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        preimage: Buffer.from(res.preimage, "hex"),
        transactionHash: Buffer.from(res.transactionHash, "hex"),
    };
};

export const postSubmarineClaimDetails = (
    id: string,
    pubNonce: Buffer | Uint8Array,
    partialSignature: Buffer | Uint8Array,
) => {
    checkCooperative();
    return fetcher(`/v2/swap/submarine/${id}/claim`, {
        pubNonce: Buffer.from(pubNonce).toString("hex"),
        partialSignature: Buffer.from(partialSignature).toString("hex"),
    });
};

export const getEipRefundSignature = (id: string, type: SwapType) => {
    checkCooperative();
    return fetcher<{ signature: string }>(`/v2/swap/${type}/${id}/refund`);
};

export const getFeeEstimations = () =>
    fetcher<Record<string, number>>("/v2/chain/fees");

export const getNodeStats = () =>
    fetcher<{
        BTC: {
            total: {
                capacity: number;
                channels: number;
                peers: number;
                oldestChannel: number;
            };
        };
    }>("/v2/nodes/stats");

export const getContracts = () =>
    fetcher<Record<string, Contracts>>("/v2/chain/contracts");

export const broadcastTransaction = async (
    asset: string,
    txHex: string,
): Promise<{
    id: string;
}> => {
    const promises: Promise<{
        id: string;
    }>[] = [
        fetcher<{ id: string }>(`/v2/chain/${asset}/transaction`, {
            hex: txHex,
        }),
        broadcastToExplorer(asset, txHex),
    ];

    const results = await Promise.allSettled(promises);
    const successfulResult = results.find(
        (result) => result.status === "fulfilled",
    );
    if (successfulResult) {
        return (successfulResult as PromiseFulfilledResult<{ id: string }>)
            .value;
    }

    throw (results[0] as PromiseRejectedResult).reason;
};

export const getLockupTransaction = async (
    id: string,
    type: SwapType,
): Promise<LockupTransaction> => {
    switch (type) {
        case SwapType.Submarine:
            return fetcher<{
                id: string;
                hex: string;
                timeoutBlockHeight: number;
                timeoutEta?: number;
            }>(`/v2/swap/submarine/${id}/transaction`);

        case SwapType.Chain: {
            const res = await getChainSwapTransactions(id);
            return {
                id: res.userLock.transaction.id,
                hex: res.userLock.transaction.hex,
                timeoutEta: res.userLock.timeout.eta,
                timeoutBlockHeight: res.userLock.timeout.blockHeight,
            };
        }

        default:
            throw `cannot get lockup transaction for swap type ${type}`;
    }
};

export const getReverseTransaction = (id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
    }>(`/v2/swap/reverse/${id}/transaction`);

export const getSwapStatus = (id: string) =>
    fetcher<SwapStatus>(`/v2/swap/${id}`);

export const getChainSwapClaimDetails = (id: string) =>
    fetcher<{
        pubNonce: string;
        publicKey: string;
        transactionHash: string;
    }>(`/v2/swap/chain/${id}/claim`);

export const postChainSwapDetails = (
    id: string,
    preimage: string | undefined,
    signature: { pubNonce: string; partialSignature: string },
    toSign?: { pubNonce: string; transaction: string; index: number },
) => {
    checkCooperative();
    return fetcher<{
        pubNonce: string;
        partialSignature: string;
    }>(`/v2/swap/chain/${id}/claim`, {
        preimage,
        signature,
        toSign,
    });
};

export const getChainSwapTransactions = (id: string) =>
    fetcher<{
        userLock: ChainSwapTransaction;
        serverLock: ChainSwapTransaction;
    }>(`/v2/swap/chain/${id}/transactions`);

export const getChainSwapNewQuote = (id: string) =>
    fetcher<{ amount: number }>(`/v2/swap/chain/${id}/quote`);

export const acceptChainSwapNewQuote = (id: string, amount: number) =>
    fetcher<object>(`/v2/swap/chain/${id}/quote`, { amount });

export const getSubmarinePreimage = (id: string) =>
    fetcher<{ preimage: string }>(`/v2/swap/submarine/${id}/preimage`);

export const getRestorableSwaps = (xpub: string) =>
    fetcher<RestorableSwap[]>(`/v2/swap/restore`, { xpub });

export {
    Pairs,
    Contracts,
    PartialSignature,
    ChainPairTypeTaproot,
    TransactionInterface,
    ReversePairTypeTaproot,
    SubmarineCreatedResponse,
    SubmarinePairTypeTaproot,
    ReverseCreatedResponse,
    ChainSwapDetails,
    ChainSwapCreatedResponse,
};
