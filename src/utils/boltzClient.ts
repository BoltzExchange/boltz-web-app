import { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";

import { config } from "../config";
import { SwapType } from "../consts/Enums";
import { fetcher } from "./helper";

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

export type LockupTransaction = {
    id: string;
    hex: string;
    timeoutBlockHeight: number;
    timeoutEta?: number;
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

export const getPairs = async (asset: string): Promise<Pairs> => {
    const [submarine, reverse, chain] = await Promise.all([
        fetcher<SubmarinePairsTaproot>("/v2/swap/submarine", asset),
        fetcher<ReversePairsTaproot>("/v2/swap/reverse", asset),
        fetcher<ChainPairsTaproot>("/v2/swap/chain", asset).catch((error) => {
            // Handle API endpoints that do not have chain swaps yet gracefully
            if (error.status === 404) {
                return {};
            }

            throw error;
        }),
    ]);

    return {
        [SwapType.Chain]: chain,
        [SwapType.Reverse]: reverse,
        [SwapType.Submarine]: submarine,
    };
};

export const createSubmarineSwap = (
    from: string,
    to: string,
    invoice: string,
    pairHash: string,
    referralId: string,
    refundPublicKey?: string,
): Promise<SubmarineCreatedResponse> =>
    fetcher("/v2/swap/submarine", to, {
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
    fetcher("/v2/swap/reverse", to, {
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
    userLockAmount: number,
    preimageHash: string,
    claimPublicKey: string | undefined,
    refundPublicKey: string | undefined,
    claimAddress: string | undefined,
    pairHash: string,
    referralId: string,
): Promise<ChainSwapCreatedResponse> =>
    fetcher("/v2/swap/chain", to, {
        from,
        to,
        userLockAmount,
        preimageHash,
        claimPublicKey,
        refundPublicKey,
        claimAddress,
        pairHash,
        referralId,
    });

export const getPartialRefundSignature = async (
    asset: string,
    id: string,
    type: SwapType,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher(
        `/v2/swap/${
            type === SwapType.Submarine ? "submarine" : "chain"
        }/${id}/refund`,
        asset,
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
    asset: string,
    id: string,
    preimage: Buffer,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
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
) => {
    checkCooperative();
    return fetcher(`/v2/swap/submarine/${id}/claim`, asset, {
        pubNonce: Buffer.from(pubNonce).toString("hex"),
        partialSignature: Buffer.from(partialSignature).toString("hex"),
    });
};

export const getEipRefundSignature = (
    asset: string,
    id: string,
    type: SwapType,
) => {
    checkCooperative();
    return fetcher<{ signature: string }>(
        `/v2/swap/${type}/${id}/refund`,
        asset,
    );
};

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

export const getLockupTransaction = async (
    asset: string,
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
            }>(`/v2/swap/submarine/${id}/transaction`, asset);

        case SwapType.Chain:
            const res = await getChainSwapTransactions(asset, id);
            return {
                id: res.userLock.transaction.id,
                hex: res.userLock.transaction.hex,
                timeoutEta: res.userLock.timeout.eta,
                timeoutBlockHeight: res.userLock.timeout.blockHeight,
            };

        default:
            throw `cannot get lockup transaction for swap type ${type}`;
    }
};

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

export const getChainSwapClaimDetails = (asset: string, id: string) =>
    fetcher<{
        pubNonce: string;
        publicKey: string;
        transactionHash: string;
    }>(`/v2/swap/chain/${id}/claim`, asset);

export const postChainSwapDetails = (
    asset: string,
    id: string,
    preimage: string,
    signature: { pubNonce: string; partialSignature: string },
    toSign: { pubNonce: string; transaction: string; index: number },
) => {
    checkCooperative();
    return fetcher<{
        pubNonce: string;
        partialSignature: string;
    }>(`/v2/swap/chain/${id}/claim`, asset, {
        preimage,
        signature,
        toSign,
    });
};

export const getChainSwapTransactions = (asset: string, id: string) =>
    fetcher<{
        userLock: ChainSwapTransaction;
        serverLock: ChainSwapTransaction;
    }>(`/v2/swap/chain/${id}/transactions`, asset);

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
