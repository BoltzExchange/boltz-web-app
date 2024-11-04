import { Transaction } from "bitcoinjs-lib";
import { Musig } from "boltz-core";
import { Buffer } from "buffer";
import { Transaction as LiquidTransaction } from "liquidjs-lib";

import { config } from "../config";
import { SwapType } from "../consts/Enums";
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

export const getPairs = async (backend: number): Promise<Pairs> => {
    const [submarine, reverse, chain] = await Promise.all([
        fetcher<SubmarinePairsTaproot>(backend, "/v2/swap/submarine"),
        fetcher<ReversePairsTaproot>(backend, "/v2/swap/reverse"),
        fetcher<ChainPairsTaproot>(backend, "/v2/swap/chain"),
    ]);

    return {
        [SwapType.Chain]: chain,
        [SwapType.Reverse]: reverse,
        [SwapType.Submarine]: submarine,
    };
};

export const getAllPairs = (): Promise<(Pairs | null)[]> => {
    const promises: Promise<Pairs | null>[] = [];

    for (let i = 0; i < config.backends.length; i++) {
        promises.push(
            getPairs(i).catch(() => null), // Catch error and return null for offline backends
        );
    }

    return Promise.all(promises);
};

export const fetchBolt12Invoice = async (
    backend: number,
    offer: string,
    amountSat: number,
): Promise<{ invoice: string }> => {
    const res = await fetcher<{ invoice: string }>(
        backend,
        "/v2/lightning/BTC/bolt12/fetch",
        {
            offer,
            amount: amountSat,
        },
    );
    await validateInvoiceForOffer(offer, res.invoice);

    return res;
};

export const createSubmarineSwap = (
    backend: number,
    from: string,
    to: string,
    invoice: string,
    pairHash: string,
    referralId: string,
    refundPublicKey?: string,
): Promise<SubmarineCreatedResponse> => {
    // remember the backend
    return fetcher(backend, "/v2/swap/submarine", {
        from,
        to,
        invoice,
        refundPublicKey,
        pairHash,
        referralId,
    });
};

export const createReverseSwap = (
    backend: number,
    from: string,
    to: string,
    invoiceAmount: number,
    preimageHash: string,
    pairHash: string,
    referralId: string,
    claimPublicKey?: string,
    claimAddress?: string,
): Promise<ReverseCreatedResponse> => {
    return fetcher(backend, "/v2/swap/reverse", {
        from,
        to,
        invoiceAmount,
        preimageHash,
        claimPublicKey,
        claimAddress,
        referralId,
        pairHash,
    });
};

export const createChainSwap = (
    backend: number,
    from: string,
    to: string,
    userLockAmount: number,
    preimageHash: string,
    claimPublicKey: string | undefined,
    refundPublicKey: string | undefined,
    claimAddress: string | undefined,
    pairHash: string,
    referralId: string,
): Promise<ChainSwapCreatedResponse> => {
    return fetcher(backend, "/v2/swap/chain", {
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
};

export const getPartialRefundSignature = async (
    backend: number,
    id: string,
    type: SwapType,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher<{ pubNonce: string; partialSignature: string }>(
        backend,
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
    backend: number,
    id: string,
    preimage: Buffer,
    pubNonce: Buffer,
    transaction: TransactionInterface,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher<{ pubNonce: string; partialSignature: string }>(
        backend,
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

export const getSubmarineClaimDetails = async (backend: number, id: string) => {
    const res = await fetcher<{
        pubNonce: string;
        preimage: string;
        transactionHash: string;
    }>(backend, `/v2/swap/submarine/${id}/claim`);
    return {
        pubNonce: Musig.parsePubNonce(res.pubNonce),
        preimage: Buffer.from(res.preimage, "hex"),
        transactionHash: Buffer.from(res.transactionHash, "hex"),
    };
};

export const postSubmarineClaimDetails = (
    backend: number,
    id: string,
    pubNonce: Buffer | Uint8Array,
    partialSignature: Buffer | Uint8Array,
) => {
    checkCooperative();
    return fetcher(backend, `/v2/swap/submarine/${id}/claim`, {
        pubNonce: Buffer.from(pubNonce).toString("hex"),
        partialSignature: Buffer.from(partialSignature).toString("hex"),
    });
};

export const getEipRefundSignature = (
    backend: number,
    id: string,
    type: SwapType,
) => {
    checkCooperative();
    return fetcher<{ signature: string }>(
        backend,
        `/v2/swap/${type}/${id}/refund`,
    );
};

export const getFeeEstimations = (backend: number) =>
    fetcher<Record<string, number>>(backend, "/v2/chain/fees");

export const getNodeStats = (backend: number) =>
    fetcher<{
        BTC: {
            total: {
                capacity: number;
                channels: number;
                peers: number;
                oldestChannel: number;
            };
        };
    }>(backend, "/v2/nodes/stats");

export const getContracts = (backend: number) =>
    fetcher<Record<string, Contracts>>(backend, "/v2/chain/contracts");

export const broadcastTransaction = (
    backend: number,
    asset: string,
    txHex: string,
) => {
    return fetcher<{ id: string }>(backend, `/v2/chain/${asset}/transaction`, {
        hex: txHex,
    });
};

export const getLockupTransaction = async (
    backend: number,
    id: string,
    type: SwapType,
): Promise<{
    id: string;
    hex: string;
    timeoutBlockHeight: number;
    timeoutEta?: number;
}> => {
    switch (type) {
        case SwapType.Submarine:
            return fetcher<{
                id: string;
                hex: string;
                timeoutBlockHeight: number;
                timeoutEta?: number;
            }>(backend, `/v2/swap/submarine/${id}/transaction`);

        case SwapType.Chain: {
            const res = await getChainSwapTransactions(backend, id);
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

export const getReverseTransaction = (backend: number, id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
    }>(backend, `/v2/swap/reverse/${id}/transaction`);

export const getSwapStatus = (backend: number, id: string) =>
    fetcher<{
        status: string;
        failureReason?: string;
        zeroConfRejected?: boolean;
        transaction?: {
            id: string;
            hex: string;
        };
    }>(backend, `/v2/swap/${id}`);

export const getChainSwapClaimDetails = (backend: number, id: string) =>
    fetcher<{
        pubNonce: string;
        publicKey: string;
        transactionHash: string;
    }>(backend, `/v2/swap/chain/${id}/claim`);

export const postChainSwapDetails = (
    backend: number,
    id: string,
    preimage: string,
    signature: { pubNonce: string; partialSignature: string },
    toSign: { pubNonce: string; transaction: string; index: number },
) => {
    checkCooperative();
    return fetcher<{
        pubNonce: string;
        partialSignature: string;
    }>(backend, `/v2/swap/chain/${id}/claim`, {
        preimage,
        signature,
        toSign,
    });
};

export const getChainSwapTransactions = (backend: number, id: string) =>
    fetcher<{
        userLock: ChainSwapTransaction;
        serverLock: ChainSwapTransaction;
    }>(backend, `/v2/swap/chain/${id}/transactions`);

export const getChainSwapNewQuote = (backend: number, id: string) =>
    fetcher<{ amount: number }>(backend, `/v2/swap/chain/${id}/quote`);

export const acceptChainSwapNewQuote = (
    backend: number,
    id: string,
    amount: number,
) => fetcher<object>(backend, `/v2/swap/chain/${id}/quote`, { amount });

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
