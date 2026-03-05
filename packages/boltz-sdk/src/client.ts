import { hex } from "@scure/base";

import {
    type ChainPairsTaproot,
    type ChainSwapCreatedResponse,
    type ChainSwapTransaction,
    type CommitmentLockupDetails,
    type Contracts,
    type LockupTransaction,
    type Pairs,
    type PartialSignature,
    type QuoteCalldata,
    type QuoteData,
    type RestorableSwap,
    type ReverseCreatedResponse,
    type ReversePairsTaproot,
    type SubmarineCreatedResponse,
    type SubmarinePairsTaproot,
    type SwapStatus,
} from "./apiTypes";
import { defaultTimeoutDuration, getConfig, resolveValue } from "./config";
import { SwapType } from "./enums";
import { formatError } from "./errors";

const getApiUrl = (): string => resolveValue(getConfig().apiUrl);

const getReferralId = (): string | undefined => {
    const { referralId } = getConfig();
    return referralId ? resolveValue(referralId) : undefined;
};

const checkCooperative = () => {
    const { cooperativeDisabled } = getConfig();
    const disabled = cooperativeDisabled
        ? resolveValue(cooperativeDisabled)
        : false;
    if (disabled) {
        throw new Error("cooperative signatures for swaps are disabled");
    }
};

export const fetcher = async <T = unknown>(
    url: string,
    params?: Record<string, unknown> | null,
    options?: RequestInit | null,
    requestTimeoutDuration?: number,
): Promise<T> => {
    const timeout =
        requestTimeoutDuration ??
        getConfig().defaultTimeout ??
        defaultTimeoutDuration;

    const controller = new AbortController();
    const requestTimeout = setTimeout(
        () => controller.abort({ reason: "Request timed out" }),
        timeout,
    );

    try {
        const referral = getReferralId();

        let opts: RequestInit = {
            headers: referral ? { referral } : {},
            signal: controller.signal,
        };

        if (params) {
            opts = {
                method: "POST",
                headers: {
                    ...(options ? options.headers : opts.headers),
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify(params),
            };
        }

        const apiUrl = getApiUrl() + url;
        const response = await fetch(apiUrl, options || opts);

        if (!response.ok) {
            try {
                const contentType = response.headers.get("content-type");
                if (contentType?.includes("application/json")) {
                    const body = await response.json();
                    return Promise.reject(formatError(body));
                }
                return Promise.reject(await response.text());

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                return Promise.reject(response);
            }
        }
        return (await response.json()) as T;
    } catch (e) {
        throw new Error(formatError(e));
    } finally {
        clearTimeout(requestTimeout);
    }
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

/**
 * Fetch lockup details for the commitment-swap flow of a specific currency.
 *
 * @param currency - Asset / chain identifier.
 * @returns Commitment contract details required to create the signature payload.
 */
export const getCommitmentLockupDetails = (currency: string) =>
    fetcher<CommitmentLockupDetails>(`/v2/commitment/${currency}/details`);

/**
 * Submit a commitment signature proving a user-side lockup transaction.
 *
 * @param currency - Asset / chain identifier.
 * @param swapId - Swap identifier.
 * @param signature - User signature over the commitment payload.
 * @param transactionHash - Hash of the lockup transaction.
 * @param logIndex - Optional log index for chains that need it.
 * @param maxOverpaymentPercentage - Optional tolerated overpayment percentage.
 */
export const postCommitmentSignature = (
    currency: string,
    swapId: string,
    signature: string,
    transactionHash: string,
    logIndex?: number,
    maxOverpaymentPercentage?: number,
) =>
    fetcher<object>(`/v2/commitment/${currency}`, {
        swapId,
        signature,
        transactionHash,
        logIndex,
        maxOverpaymentPercentage,
    });

/**
 * Request a BOLT-12 invoice from Boltz for a given offer.
 *
 * @param offer - BOLT-12 offer string.
 * @param amountSat - Desired amount in satoshis.
 * @returns An object containing the generated BOLT-12 invoice.
 */
export const fetchBolt12Invoice = async (
    offer: string,
    amountSat: number,
): Promise<{ invoice: string }> => {
    return await fetcher<{ invoice: string }>(
        "/v2/lightning/BTC/bolt12/fetch",
        {
            offer,
            amount: amountSat,
        },
    );
};

export const fetchBip21Invoice = async (invoice: string) => {
    try {
        const res = await fetcher<{ bip21: string; signature: string }>(
            `/v2/swap/reverse/${invoice}/bip21`,
        );
        return res;
    } catch {
        return null;
    }
};

export const createSubmarineSwap = (
    from: string,
    to: string,
    invoice: string,
    pairHash: string,
    refundPublicKey?: string,
): Promise<SubmarineCreatedResponse> =>
    fetcher("/v2/swap/submarine", {
        from,
        to,
        invoice,
        refundPublicKey,
        pairHash,
        referralId: getReferralId(),
    });

export const createReverseSwap = (
    from: string,
    to: string,
    invoiceAmount: number,
    preimageHash: string,
    pairHash: string,
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
        referralId: getReferralId(),
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
): Promise<ChainSwapCreatedResponse> =>
    fetcher("/v2/swap/chain", {
        from,
        to,
        preimageHash,
        claimPublicKey,
        refundPublicKey,
        claimAddress,
        pairHash,
        referralId: getReferralId(),
        userLockAmount,
    });

export const getPartialRefundSignature = async (
    id: string,
    type: SwapType,
    pubNonce: Uint8Array,
    transactionHex: string,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher<{
        pubNonce: string;
        partialSignature: string;
    }>(
        `/v2/swap/${
            type === SwapType.Submarine ? "submarine" : "chain"
        }/${id}/refund`,
        {
            index,
            pubNonce: hex.encode(pubNonce),
            transaction: transactionHex,
        },
    );
    return {
        pubNonce: hex.decode(res.pubNonce),
        signature: hex.decode(res.partialSignature),
    };
};

export const getPartialReverseClaimSignature = async (
    id: string,
    preimage: Uint8Array,
    pubNonce: Uint8Array,
    transactionHex: string,
    index: number,
): Promise<PartialSignature> => {
    checkCooperative();
    const res = await fetcher<{
        pubNonce: string;
        partialSignature: string;
    }>(`/v2/swap/reverse/${id}/claim`, {
        index,
        preimage: hex.encode(preimage),
        pubNonce: hex.encode(pubNonce),
        transaction: transactionHex,
    });
    return {
        pubNonce: hex.decode(res.pubNonce),
        signature: hex.decode(res.partialSignature),
    };
};

export const getSubmarineClaimDetails = async (id: string) => {
    const res = await fetcher<{
        pubNonce: string;
        preimage: string;
        transactionHash: string;
    }>(`/v2/swap/submarine/${id}/claim`);
    return {
        pubNonce: hex.decode(res.pubNonce),
        preimage: hex.decode(res.preimage),
        transactionHash: hex.decode(res.transactionHash),
    };
};

export const postSubmarineClaimDetails = (
    id: string,
    pubNonce: Uint8Array,
    partialSignature: Uint8Array,
) => {
    checkCooperative();
    return fetcher(`/v2/swap/submarine/${id}/claim`, {
        pubNonce: hex.encode(pubNonce),
        partialSignature: hex.encode(partialSignature),
    });
};

export const getEipRefundSignature = (id: string, type: SwapType) => {
    checkCooperative();
    return fetcher<{ signature: string }>(`/v2/swap/${type}/${id}/refund`);
};

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

export const getSwapStatus = (id: string) =>
    fetcher<SwapStatus>(`/v2/swap/${id}`);

export const broadcastTransaction = (
    asset: string,
    txHex: string,
): Promise<{ id: string }> =>
    fetcher<{ id: string }>(`/v2/chain/${asset}/transaction`, {
        hex: txHex,
    });

export const getChainSwapTransactions = (id: string) =>
    fetcher<{
        userLock: ChainSwapTransaction;
        serverLock: ChainSwapTransaction;
    }>(`/v2/swap/chain/${id}/transactions`);

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
                hex: res.userLock.transaction.hex ?? "",
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

export const getChainSwapClaimDetails = (id: string) =>
    fetcher<{
        pubNonce: string;
        publicKey: string;
        transactionHash: string;
    }>(`/v2/swap/chain/${id}/claim`);

export const getChainSwapNewQuote = (id: string) =>
    fetcher<{ amount: number }>(`/v2/swap/chain/${id}/quote`);

export const acceptChainSwapNewQuote = (id: string, amount: number) =>
    fetcher<object>(`/v2/swap/chain/${id}/quote`, { amount });

export const getSubmarinePreimage = (id: string) =>
    fetcher<{ preimage: string }>(`/v2/swap/submarine/${id}/preimage`);

export const getRestorableSwaps = (
    xpub: string,
    pagination?: { startIndex: number; limit: number },
) =>
    fetcher<RestorableSwap[]>(
        `/v2/swap/restore`,
        { xpub, pagination },
        null,
        30_000,
    );

export const assetRescueSetup = (
    asset: string,
    swapId: string,
    transactionId: string,
    vout: number,
    destination: string,
) =>
    fetcher<{
        musig: {
            serverPublicKey: string;
            pubNonce: string;
            message: string;
        };
        transaction: string;
    }>(`/v2/asset/${asset}/rescue/setup`, {
        swapId,
        transactionId,
        vout,
        destination,
    });

export const assetRescueBroadcast = (
    asset: string,
    swapId: string,
    pubNonce: Uint8Array,
    partialSignature: Uint8Array,
) =>
    fetcher<{
        transactionId: string;
    }>(`/v2/asset/${asset}/rescue/broadcast`, {
        swapId,
        pubNonce: hex.encode(pubNonce),
        partialSignature: hex.encode(partialSignature),
    });

/**
 * Request DEX quotes for a fixed input amount.
 *
 * @param chain - Chain identifier.
 * @param tokenIn - Input token address.
 * @param tokenOut - Output token address.
 * @param amountIn - Input amount in token base units.
 * @returns Candidate quotes ordered by the backend.
 */
export const quoteDexAmountIn = async (
    chain: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
): Promise<QuoteData[]> => {
    const params = new URLSearchParams();
    params.set("tokenIn", tokenIn);
    params.set("tokenOut", tokenOut);
    params.set("amountIn", amountIn.toString());
    return await fetcher(`/v2/quote/${chain}/in?${params.toString()}`);
};

/**
 * Request DEX quotes for a fixed output amount.
 *
 * @param chain - Chain identifier.
 * @param tokenIn - Input token address.
 * @param tokenOut - Output token address.
 * @param amountOut - Desired output amount in token base units.
 * @returns Candidate quotes ordered by the backend.
 */
export const quoteDexAmountOut = async (
    chain: string,
    tokenIn: string,
    tokenOut: string,
    amountOut: bigint,
): Promise<QuoteData[]> => {
    const params = new URLSearchParams();
    params.set("tokenIn", tokenIn);
    params.set("tokenOut", tokenOut);
    params.set("amountOut", amountOut.toString());
    return await fetcher(`/v2/quote/${chain}/out?${params.toString()}`);
};

/**
 * Encode a previously selected DEX quote into contract calls.
 *
 * @param chain - Chain identifier.
 * @param recipient - Recipient address for the final output.
 * @param amountIn - Input amount in token base units.
 * @param amountOutMin - Minimum acceptable output amount in token base units.
 * @param data - Opaque quote payload returned by the quote endpoints.
 * @returns Contract calls required to execute the quoted route.
 */
export const encodeDexQuote = (
    chain: string,
    recipient: string,
    amountIn: bigint,
    amountOutMin: bigint,
    data: QuoteData["data"],
) =>
    fetcher<{ calls: QuoteCalldata[] }>(`/v2/quote/${chain}/encode`, {
        recipient,
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        data,
    });
