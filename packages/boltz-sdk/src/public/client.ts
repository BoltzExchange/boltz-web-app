import { hex } from "@scure/base";

import { defaultTimeoutDuration, resolveValue } from "../internal/utils";
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
import { getConfig } from "./config";
import { SwapType } from "./enums";
import { ApiError, SwapError, formatError } from "./errors";

/** Resolve the current Boltz API base URL from configuration. */
const getApiUrl = (): string => resolveValue(getConfig().apiUrl);

/** Resolve the optional referral ID from configuration. */
const getReferralId = (): string | undefined => {
    const { referralId } = getConfig();
    return referralId ? resolveValue(referralId) : undefined;
};

/**
 * Assert that cooperative (MuSig) signing is enabled.
 *
 * @throws If cooperative signatures are disabled in the SDK configuration.
 */
const checkCooperative = () => {
    const { cooperativeDisabled } = getConfig();
    const disabled = cooperativeDisabled
        ? resolveValue(cooperativeDisabled)
        : false;
    if (disabled) {
        throw new Error("cooperative signatures for swaps are disabled");
    }
};

/**
 * Generic HTTP fetcher for the Boltz API.
 *
 * - When `params` is provided the request is sent as `POST` with a JSON body.
 * - Adds the `referral` header when a referral ID is configured.
 * - Applies a configurable request timeout via `AbortController`.
 *
 * @typeParam T - Expected shape of the JSON response.
 * @param url - API path (appended to the base URL, e.g. `"/v2/swap/submarine"`).
 * @param params - Optional POST body (triggers `POST` method when present).
 * @param options - Optional custom `RequestInit` overrides.
 * @param requestTimeoutDuration - Override the default request timeout in ms.
 * @returns The parsed JSON response body.
 * @throws On non-OK HTTP responses or network / timeout errors.
 */
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
                    throw new ApiError(
                        formatError(body),
                        response.status,
                    );
                }
                throw new ApiError(
                    await response.text(),
                    response.status,
                );
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                if (e instanceof ApiError) throw e;
                throw new ApiError(
                    `HTTP ${response.status} ${response.statusText}`,
                    response.status,
                );
            }
        }
        return (await response.json()) as T;
    } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError(formatError(e));
    } finally {
        clearTimeout(requestTimeout);
    }
};

/**
 * Fetch all swap pair configurations (submarine, reverse, chain) from the API.
 *
 * @param options - Optional `RequestInit` overrides forwarded to each sub-request.
 * @returns A {@link Pairs} object keyed by {@link SwapType}.
 */
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

/**
 * Fetch on-chain fee estimations (sat/vByte) per asset.
 *
 * @returns A record mapping asset identifiers to their current fee rate.
 */
export const getFeeEstimations = () =>
    fetcher<Record<string, number>>("/v2/chain/fees");

/**
 * Fetch Lightning node statistics from the Boltz backend.
 *
 * @returns Node stats including capacity, channels, peers, and oldest channel age.
 */
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

/**
 * Fetch EVM swap contract addresses for all supported chains.
 *
 * @returns A record mapping chain identifiers to their {@link Contracts}.
 */
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
    validateInvoiceForOffer?: (
        offer: string,
        invoice: string,
    ) => Promise<void>,
): Promise<{ invoice: string }> => {
    const res = await fetcher<{ invoice: string }>(
        "/v2/lightning/BTC/bolt12/fetch",
        {
            offer,
            amount: amountSat,
        },
    );

    if (validateInvoiceForOffer) {
        await validateInvoiceForOffer(offer, res.invoice);
    }

    return res;
};

/**
 * Fetch a BIP-21 URI for a reverse swap invoice (used for unified QR codes).
 *
 * @param invoice - The reverse swap invoice identifier.
 * @returns An object with the BIP-21 URI and server signature, or `null` on failure.
 */
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

/**
 * Create a submarine swap (on-chain → Lightning).
 *
 * @param from - Source asset (e.g. `"BTC"`, `"L-BTC"`).
 * @param to - Destination asset (e.g. `"BTC"` for LN).
 * @param invoice - BOLT-11 invoice to pay.
 * @param pairHash - Pair configuration hash from {@link getPairs}.
 * @param refundPublicKey - Optional refund public key (hex) for Taproot refund path.
 * @returns The API response with swap details.
 */
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

/**
 * Create a reverse swap (Lightning → on-chain).
 *
 * @param from - Source asset (e.g. `"BTC"` for LN).
 * @param to - Destination asset (e.g. `"BTC"`, `"L-BTC"`).
 * @param invoiceAmount - Amount in satoshis for the generated invoice.
 * @param preimageHash - Hex-encoded SHA-256 hash of the preimage.
 * @param pairHash - Pair configuration hash from {@link getPairs}.
 * @param claimPublicKey - Optional claim public key (hex) for Taproot claim path.
 * @param claimAddress - Optional on-chain address where funds should be claimed to.
 * @returns The API response with swap details.
 */
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

/**
 * Create a chain swap (on-chain → on-chain).
 *
 * @param from - Source chain asset.
 * @param to - Destination chain asset.
 * @param userLockAmount - Amount in satoshis the user will lock (may be undefined for server-determined amounts).
 * @param preimageHash - Hex-encoded SHA-256 hash of the preimage.
 * @param claimPublicKey - Claim public key (hex) for the destination chain.
 * @param refundPublicKey - Refund public key (hex) for the source chain.
 * @param claimAddress - On-chain address to claim funds to.
 * @param pairHash - Pair configuration hash from {@link getPairs}.
 * @returns The API response with swap details.
 */
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

/**
 * Request a cooperative partial refund signature from Boltz.
 *
 * Used for submarine and chain swaps when the user wants to reclaim
 * their locked funds cooperatively (without waiting for timeout).
 *
 * @param id - Swap identifier.
 * @param type - Swap type (Submarine or Chain).
 * @param pubNonce - User's MuSig2 public nonce.
 * @param transactionHex - Hex-encoded unsigned refund transaction.
 * @param index - Input index to sign.
 * @returns Boltz's partial signature and public nonce.
 */
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

/**
 * Request a cooperative partial claim signature from Boltz for a reverse swap.
 *
 * @param id - Swap identifier.
 * @param preimage - The swap preimage (proves payment).
 * @param pubNonce - User's MuSig2 public nonce.
 * @param transactionHex - Hex-encoded unsigned claim transaction.
 * @param index - Input index to sign.
 * @returns Boltz's partial signature and public nonce.
 */
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

/**
 * Fetch the claim details for a submarine swap (preimage + server nonce).
 *
 * Called after the server has claimed the Lightning payment to obtain the
 * preimage and cooperative signing data.
 *
 * @param id - Swap identifier.
 * @returns Decoded public nonce, preimage, and transaction hash.
 */
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

/**
 * Post the user's cooperative claim signature for a submarine swap.
 *
 * After the server reveals the preimage, the user co-signs the claim
 * transaction so Boltz can broadcast it.
 *
 * @param id - Swap identifier.
 * @param pubNonce - User's MuSig2 public nonce.
 * @param partialSignature - User's partial Schnorr signature.
 */
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

/**
 * Request a cooperative EIP-712 refund signature for an EVM swap.
 *
 * @param id - Swap identifier.
 * @param type - Swap type.
 * @returns An object containing the EIP-712 signature.
 */
export const getEipRefundSignature = (id: string, type: SwapType) => {
    checkCooperative();
    return fetcher<{ signature: string }>(`/v2/swap/${type}/${id}/refund`);
};

/**
 * Post claim details for a chain swap, including the preimage and
 * cooperative signature.
 *
 * Optionally includes a `toSign` object when the server needs to
 * co-sign a user-side transaction as well.
 *
 * @param id - Swap identifier.
 * @param preimage - Hex-encoded preimage (may be `undefined` if not yet known).
 * @param signature - User's MuSig2 partial signature with public nonce.
 * @param toSign - Optional transaction for the server to co-sign.
 * @returns Boltz's partial signature and public nonce.
 */
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

/**
 * Fetch the current status of a swap.
 *
 * @param id - Swap identifier.
 * @returns The current {@link SwapStatus}.
 */
export const getSwapStatus = (id: string) =>
    fetcher<SwapStatus>(`/v2/swap/${id}`);

/**
 * Broadcast a signed transaction to the network via Boltz.
 *
 * @param asset - The chain asset (e.g. `"BTC"`, `"L-BTC"`).
 * @param txHex - Hex-encoded signed transaction.
 * @returns An object containing the broadcast transaction ID.
 */
export const broadcastTransaction = async (
    asset: string,
    txHex: string,
    explorerBroadcast?: (
        asset: string,
        txHex: string,
    ) => Promise<{ id: string }>,
): Promise<{ id: string }> => {
    const promises: Promise<{ id: string }>[] = [
        fetcher<{ id: string }>(`/v2/chain/${asset}/transaction`, {
            hex: txHex,
        }),
    ];

    if (explorerBroadcast) {
        promises.push(explorerBroadcast(asset, txHex));
    }

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

/**
 * Fetch both user-lock and server-lock transactions for a chain swap.
 *
 * @param id - Swap identifier.
 * @returns An object with `userLock` and `serverLock` transaction details.
 */
export const getChainSwapTransactions = (id: string) =>
    fetcher<{
        userLock: ChainSwapTransaction;
        serverLock: ChainSwapTransaction;
    }>(`/v2/swap/chain/${id}/transactions`);

/**
 * Fetch the lockup transaction for a submarine or chain swap.
 *
 * @param id - Swap identifier.
 * @param type - Swap type (Submarine or Chain).
 * @returns The {@link LockupTransaction} details.
 * @throws For unsupported swap types (e.g. Reverse).
 */
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
            throw new SwapError(
                `cannot get lockup transaction for swap type ${type}`,
            );
    }
};

/**
 * Fetch the reverse swap lockup transaction from the server.
 *
 * @param id - Swap identifier.
 * @returns Transaction ID, hex, and timeout block height.
 */
export const getReverseTransaction = (id: string) =>
    fetcher<{
        id: string;
        hex: string;
        timeoutBlockHeight: number;
    }>(`/v2/swap/reverse/${id}/transaction`);

/**
 * Fetch server-side claim details for a chain swap.
 *
 * @param id - Swap identifier.
 * @returns Server's public nonce, public key, and transaction hash.
 */
export const getChainSwapClaimDetails = (id: string) =>
    fetcher<{
        pubNonce: string;
        publicKey: string;
        transactionHash: string;
    }>(`/v2/swap/chain/${id}/claim`);

/**
 * Request a new quote for a chain swap (e.g. when amounts have changed).
 *
 * @param id - Swap identifier.
 * @returns An object containing the new quoted amount in satoshis.
 */
export const getChainSwapNewQuote = (id: string) =>
    fetcher<{ amount: number }>(`/v2/swap/chain/${id}/quote`);

/**
 * Accept a new quote for a chain swap.
 *
 * @param id - Swap identifier.
 * @param amount - The accepted amount in satoshis.
 */
export const acceptChainSwapNewQuote = (id: string, amount: number) =>
    fetcher<object>(`/v2/swap/chain/${id}/quote`, { amount });

/**
 * Fetch the preimage for a submarine swap after the invoice has been paid.
 *
 * @param id - Swap identifier.
 * @returns An object containing the hex-encoded preimage.
 */
export const getSubmarinePreimage = (id: string) =>
    fetcher<{ preimage: string }>(`/v2/swap/submarine/${id}/preimage`);

/**
 * Restore swaps associated with an extended public key.
 *
 * @param xpub - Extended public key used to derive swap keys.
 * @param pagination - Optional pagination parameters.
 * @returns An array of {@link RestorableSwap} records.
 */
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

/**
 * Initiate an asset rescue by requesting a MuSig2 signing session from Boltz.
 *
 * Used to recover funds stuck in swap outputs that were not properly claimed.
 *
 * @param asset - The chain asset.
 * @param swapId - Swap identifier.
 * @param transactionId - TXID of the transaction containing the stuck output.
 * @param vout - Output index of the stuck UTXO.
 * @param destination - Address to send the rescued funds to.
 * @returns MuSig2 session data and the unsigned rescue transaction.
 */
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

/**
 * Broadcast a cooperatively signed asset rescue transaction.
 *
 * @param asset - The chain asset.
 * @param swapId - Swap identifier.
 * @param pubNonce - User's MuSig2 public nonce.
 * @param partialSignature - User's partial Schnorr signature.
 * @returns An object containing the broadcast transaction ID.
 */
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

const sortDexQuotes = (
    quotes: QuoteData[],
    direction: "in" | "out",
): QuoteData[] =>
    [...quotes].sort((first, second) => {
        const firstAmount = BigInt(first.quote);
        const secondAmount = BigInt(second.quote);

        if (firstAmount === secondAmount) {
            return 0;
        }

        if (direction === "in") {
            return firstAmount > secondAmount ? -1 : 1;
        }

        return firstAmount < secondAmount ? -1 : 1;
    });

/**
 * Request DEX quotes for a fixed input amount.
 *
 * @param chain - Chain identifier.
 * @param tokenIn - Input token address.
 * @param tokenOut - Output token address.
 * @param amountIn - Input amount in token base units.
 * @returns Candidate quotes sorted by best price.
 */
export const quoteDexAmountIn = async (
    chain: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
): Promise<QuoteData[]> => {
    if (amountIn === 0n) {
        return [];
    }

    const params = new URLSearchParams();
    params.set("tokenIn", tokenIn);
    params.set("tokenOut", tokenOut);
    params.set("amountIn", amountIn.toString());
    return sortDexQuotes(
        await fetcher(`/v2/quote/${chain}/in?${params.toString()}`),
        "in",
    );
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
    if (amountOut === 0n) {
        return [];
    }

    const params = new URLSearchParams();
    params.set("tokenIn", tokenIn);
    params.set("tokenOut", tokenOut);
    params.set("amountOut", amountOut.toString());
    return sortDexQuotes(
        await fetcher(`/v2/quote/${chain}/out?${params.toString()}`),
        "out",
    );
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
