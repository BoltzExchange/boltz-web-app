import { Buffer } from "buffer";
import { networks as LiquidNetworks, payments } from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { config } from "../config";
import { LUSDT } from "../consts/Assets";

export type SideSwapAssetPair = {
    base: string;
    quote: string;
};

export type SideSwapUtxo = {
    txid: string;
    vout: number;
    asset: string;
    value: number;
    asset_bf: string;
    value_bf: string;
    redeem_script?: string | null;
};

export type SideSwapQuoteSuccess = {
    quote_id: number;
    base_amount: number;
    quote_amount: number;
    server_fee: number;
    fixed_fee: number;
    ttl: number;
};

type SideSwapQuoteNotification = {
    amount: number;
    asset_pair: SideSwapAssetPair;
    asset_type: string;
    trade_dir: string;
    quote_sub_id: number;
    status:
        | { Success: SideSwapQuoteSuccess }
        | { LowBalance: SideSwapQuoteSuccess & { available: number } }
        | { Error: { error_msg: string } };
};

export type SideSwapMarket = {
    asset_pair: SideSwapAssetPair;
    fee_asset: SideSwapFeeAsset;
    type: string;
};

export type SideSwapQuoteResponse = {
    pset: string;
    ttl: number;
};

export type SideSwapTakerSignResponse = {
    txid: string;
};

type StartQuotesResult = {
    fee_asset: SideSwapFeeAsset;
    quote_sub_id: number;
};

type PendingRequest<T> = {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

type QuoteListener = (
    quote: SideSwapQuoteSuccess,
    notification: SideSwapQuoteNotification,
) => void;

type QuoteErrorListener = (
    errorMsg: string,
    notification: SideSwapQuoteNotification,
) => void;

type SideSwapQuoteRequest = {
    assetType: "Base" | "Quote";
    amount: number;
    timeoutMs?: number;
    tradeDir: "Sell" | "Buy";
};

const RPC_TIMEOUT_MS = 30_000;
const IDLE_DISCONNECT_MS = 120_000;
const ESTIMATE_CACHE_TTL_MS = 30_000;
const MINIMUM_CACHE_TTL_MS = 5 * 60_000;
const MINIMUM_PROBE_TIMEOUT_MS = 7_000;
const MINIMUM_PROBE_AMOUNTS = [100_000, 1_000_000, 10_000_000];
const UTXO_SYNC_RETRY_DELAY_MS = 5_000;
const UTXO_SYNC_MAX_WAIT_MS = 180_000;
const SIDESWAP_WALLET_SYNC_ERROR = /unknown UTXO|wait for wallet sync/i;

export const SIDESWAP_MIN_LBTC_SATS_FALLBACK = 30_000;

export const isSideSwapWalletSyncError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return SIDESWAP_WALLET_SYNC_ERROR.test(message);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class SideSwapClient {
    private ws: WebSocket | null = null;
    private nextId = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private pending = new Map<number, PendingRequest<any>>();
    private quoteListeners = new Set<QuoteListener>();
    private quoteErrorListeners = new Set<QuoteErrorListener>();
    private connectPromise: Promise<void> | null = null;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private activeSubscriptions = 0;

    private get url(): string {
        const url = config.sideswapUrl;
        if (!url) {
            throw new Error("SideSwap URL not configured");
        }
        return url;
    }

    connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.resetIdleTimer();
            return Promise.resolve();
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = new Promise<void>((resolve, reject) => {
            log.info("Connecting to SideSwap:", this.url);
            const ws = new WebSocket(this.url);

            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error("SideSwap WebSocket connection timeout"));
            }, RPC_TIMEOUT_MS);

            ws.onopen = () => {
                clearTimeout(timeout);
                this.ws = ws;
                this.connectPromise = null;
                this.resetIdleTimer();
                log.info("SideSwap WebSocket connected");
                resolve();
            };

            ws.onerror = (event) => {
                clearTimeout(timeout);
                this.connectPromise = null;
                log.error("SideSwap WebSocket error:", event);
                reject(new Error("SideSwap WebSocket connection failed"));
            };

            ws.onclose = () => {
                this.ws = null;
                this.connectPromise = null;
                this.rejectAllPending("WebSocket closed");
                log.info("SideSwap WebSocket closed");
            };

            ws.onmessage = (event) => {
                this.handleMessage(event.data as string);
            };
        });

        return this.connectPromise;
    }

    disconnect(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.rejectAllPending("Client disconnected");
    }

    private resetIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        if (this.activeSubscriptions > 0) return;
        this.idleTimer = setTimeout(() => {
            log.debug("SideSwap idle timeout, disconnecting");
            this.disconnect();
        }, IDLE_DISCONNECT_MS);
    }

    private rejectAllPending(reason: string): void {
        for (const [id, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error(reason));
            this.pending.delete(id);
        }
    }

    private handleMessage(data: string): void {
        try {
            const msg = JSON.parse(data);

            if (msg.id !== undefined && this.pending.has(msg.id)) {
                const req = this.pending.get(msg.id)!;
                this.pending.delete(msg.id);
                clearTimeout(req.timer);

                if (msg.error) {
                    req.reject(
                        new Error(
                            msg.error.message ?? JSON.stringify(msg.error),
                        ),
                    );
                } else {
                    req.resolve(msg.result);
                }
                return;
            }

            if (msg.method === "market" && msg.params?.quote) {
                const notification = msg.params
                    .quote as SideSwapQuoteNotification;
                const status = notification.status;

                if ("Success" in status) {
                    this.quoteListeners.forEach((listener) =>
                        listener(status.Success, notification),
                    );
                } else if ("LowBalance" in status) {
                    log.warn("SideSwap LowBalance:", status.LowBalance);
                    this.quoteListeners.forEach((listener) =>
                        listener(status.LowBalance, notification),
                    );
                } else if ("Error" in status) {
                    if (this.quoteErrorListeners.size === 0) {
                        log.warn(
                            "SideSwap quote error:",
                            status.Error.error_msg,
                        );
                    }
                    this.quoteErrorListeners.forEach((listener) =>
                        listener(status.Error.error_msg, notification),
                    );
                }
                return;
            }

            log.debug("SideSwap unhandled message:", msg);
        } catch (e) {
            log.error("SideSwap message parse error:", e);
        }
    }

    private async rpc<T>(method: string, params: unknown = {}): Promise<T> {
        await this.connect();

        const id = this.nextId++;
        const message = JSON.stringify({ id, method, params });

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`SideSwap RPC timeout: ${method}`));
            }, RPC_TIMEOUT_MS);

            this.pending.set(id, { resolve, reject, timer });
            this.ws!.send(message);
            this.resetIdleTimer();
        });
    }

    async listMarkets(): Promise<SideSwapMarket[]> {
        const result = await this.rpc<{
            list_markets: { markets: SideSwapMarket[] };
        }>("market", { list_markets: {} });
        return result.list_markets.markets;
    }

    async startQuotes(params: {
        assetPair: SideSwapAssetPair;
        assetType: "Base" | "Quote";
        amount: number;
        tradeDir: "Sell" | "Buy";
        utxos?: SideSwapUtxo[];
        receiveAddress?: string;
        changeAddress?: string;
    }): Promise<StartQuotesResult> {
        this.activeSubscriptions++;
        try {
            const result = await this.rpc<{ start_quotes: StartQuotesResult }>(
                "market",
                {
                    start_quotes: {
                        asset_pair: params.assetPair,
                        asset_type: params.assetType,
                        amount: params.amount,
                        trade_dir: params.tradeDir,
                        utxos: params.utxos ?? [],
                        ...(params.receiveAddress && {
                            receive_address: params.receiveAddress,
                        }),
                        ...(params.changeAddress && {
                            change_address: params.changeAddress,
                        }),
                    },
                },
            );
            return result.start_quotes;
        } catch (e) {
            this.stopQuotes();
            throw e;
        }
    }

    stopQuotes(): void {
        this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
        if (this.activeSubscriptions === 0) {
            this.disconnect();
            return;
        }
        this.resetIdleTimer();
    }

    async getQuote(quoteId: number): Promise<SideSwapQuoteResponse> {
        const result = await this.rpc<{ get_quote: SideSwapQuoteResponse }>(
            "market",
            { get_quote: { quote_id: quoteId } },
        );
        return result.get_quote;
    }

    async takerSign(
        quoteId: number,
        signedPset: string,
    ): Promise<SideSwapTakerSignResponse> {
        const result = await this.rpc<{
            taker_sign: SideSwapTakerSignResponse;
        }>("market", {
            taker_sign: { quote_id: quoteId, pset: signedPset },
        });
        return result.taker_sign;
    }

    onQuote(listener: QuoteListener): () => void {
        this.quoteListeners.add(listener);
        return () => this.quoteListeners.delete(listener);
    }

    onQuoteError(listener: QuoteErrorListener): () => void {
        this.quoteErrorListeners.add(listener);
        return () => this.quoteErrorListeners.delete(listener);
    }
}

let clientInstance: SideSwapClient | null = null;

export const getSideSwapClient = (): SideSwapClient => {
    if (!clientInstance) {
        clientInstance = new SideSwapClient();
    }
    return clientInstance;
};

export type SideSwapFeeAsset = "Base" | "Quote";

export type SideSwapEstimate = {
    receiveAmount: number;
    feeAmount: number;
    feeAsset: SideSwapFeeAsset;
    rate: number;
};

export const getSideSwapFeeAmount = (quote: SideSwapQuoteSuccess): number =>
    quote.server_fee + quote.fixed_fee;

export const getSideSwapSellBaseReceiveAmount = (
    quote: SideSwapQuoteSuccess,
    feeAsset: SideSwapFeeAsset,
): number =>
    Math.max(
        0,
        feeAsset === "Quote"
            ? quote.quote_amount - getSideSwapFeeAmount(quote)
            : quote.quote_amount,
    );

export const getSideSwapBuyQuoteDeliverAmount = (
    quote: SideSwapQuoteSuccess,
    feeAsset: SideSwapFeeAsset,
): number =>
    feeAsset === "Base"
        ? quote.base_amount + getSideSwapFeeAmount(quote)
        : quote.base_amount;

let cachedEstimate:
    | (SideSwapEstimate & {
          lbtcSats: number;
          updatedAt: number;
      })
    | null = null;

let cachedMinimum: {
    amount: number;
    updatedAt: number;
} | null = null;

const getLiquidNetwork = (): LiquidNetwork => {
    const liquidNet = config.network === "mainnet" ? "liquid" : config.network;
    return LiquidNetworks[liquidNet] as LiquidNetwork;
};

export const getSideSwapLbtcAssetId = (): string =>
    getLiquidNetwork().assetHash;

export const getSideSwapUsdtAssetId = (): string | undefined =>
    config.assets?.[LUSDT]?.liquidToken?.assetId;

export const getSideSwapAssetPair = (): SideSwapAssetPair | undefined => {
    const base = getSideSwapLbtcAssetId();
    const quote = getSideSwapUsdtAssetId();
    return quote === undefined ? undefined : { base, quote };
};

const DUMMY_PUBKEY = Buffer.from(
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "hex",
);

const getPlaceholderAddress = (): string => {
    const { address } = payments.p2wpkh({
        pubkey: DUMMY_PUBKEY,
        network: getLiquidNetwork(),
    });
    return address!;
};

const requestSideSwapQuote = async ({
    assetType,
    amount,
    timeoutMs = RPC_TIMEOUT_MS,
    tradeDir,
}: SideSwapQuoteRequest): Promise<{
    quote: SideSwapQuoteSuccess;
    feeAsset: SideSwapFeeAsset;
}> => {
    const assetPair = getSideSwapAssetPair();
    if (!assetPair) {
        throw new Error("SideSwap asset pair not configured");
    }

    const client = getSideSwapClient();
    await client.connect();

    return new Promise<{
        quote: SideSwapQuoteSuccess;
        feeAsset: SideSwapFeeAsset;
    }>((resolve, reject) => {
        let quoteSubId: number | undefined;
        let feeAsset: SideSwapFeeAsset | undefined;

        const timeout = setTimeout(() => {
            cleanupQuote();
            cleanupError();
            reject(new Error("SideSwap quote timeout"));
        }, timeoutMs);

        const cleanupQuote = client.onQuote((quote, notification) => {
            if (notification.quote_sub_id !== quoteSubId) {
                return;
            }

            clearTimeout(timeout);
            cleanupQuote();
            cleanupError();

            resolve({
                quote,
                feeAsset: feeAsset ?? "Base",
            });
        });

        const cleanupError = client.onQuoteError((errorMsg, notification) => {
            if (notification.quote_sub_id !== quoteSubId) {
                return;
            }

            clearTimeout(timeout);
            cleanupQuote();
            cleanupError();
            reject(new Error(errorMsg));
        });

        const placeholderAddress = getPlaceholderAddress();
        client
            .startQuotes({
                assetPair,
                assetType,
                amount,
                tradeDir,
                receiveAddress: placeholderAddress,
                changeAddress: placeholderAddress,
            })
            .then((res) => {
                quoteSubId = res.quote_sub_id;
                feeAsset = res.fee_asset;
            })
            .catch((e) => {
                clearTimeout(timeout);
                cleanupQuote();
                cleanupError();
                reject(e);
            });
    }).finally(() => {
        client.stopQuotes();
    });
};

const requestSideSwapReceiveQuote = (
    lbtcSats: number,
    timeoutMs = RPC_TIMEOUT_MS,
): Promise<{
    quote: SideSwapQuoteSuccess;
    feeAsset: SideSwapFeeAsset;
}> =>
    requestSideSwapQuote({
        assetType: "Base",
        amount: lbtcSats,
        timeoutMs,
        tradeDir: "Sell",
    });

export const getSideSwapMinimumLbtcSats = async (): Promise<number> => {
    if (
        cachedMinimum &&
        Date.now() - cachedMinimum.updatedAt < MINIMUM_CACHE_TTL_MS
    ) {
        return cachedMinimum.amount;
    }

    for (const probeAmount of MINIMUM_PROBE_AMOUNTS) {
        try {
            const { quote, feeAsset } = await requestSideSwapReceiveQuote(
                probeAmount,
                MINIMUM_PROBE_TIMEOUT_MS,
            );

            const amount = feeAsset === "Base" ? quote.fixed_fee + 1 : 1;
            cachedMinimum = {
                amount,
                updatedAt: Date.now(),
            };
            return amount;
        } catch (e) {
            log.warn(
                `Could not probe SideSwap minimum with ${probeAmount} sats`,
                e,
            );
        }
    }

    log.warn(
        `Falling back to SideSwap minimum of ${SIDESWAP_MIN_LBTC_SATS_FALLBACK} sats`,
    );
    return SIDESWAP_MIN_LBTC_SATS_FALLBACK;
};

export const estimateSideSwapReceive = async (
    lbtcSats: number,
): Promise<SideSwapEstimate> => {
    const minimum = await getSideSwapMinimumLbtcSats();
    if (lbtcSats <= 0 || lbtcSats < minimum) {
        return { receiveAmount: 0, feeAmount: 0, feeAsset: "Base", rate: 0 };
    }

    if (
        cachedEstimate &&
        cachedEstimate.lbtcSats === lbtcSats &&
        Date.now() - cachedEstimate.updatedAt < ESTIMATE_CACHE_TTL_MS
    ) {
        return {
            receiveAmount: cachedEstimate.receiveAmount,
            feeAmount: cachedEstimate.feeAmount,
            feeAsset: cachedEstimate.feeAsset,
            rate: cachedEstimate.rate,
        };
    }

    const { quote, feeAsset } = await requestSideSwapReceiveQuote(lbtcSats);
    const receiveAmount = getSideSwapSellBaseReceiveAmount(quote, feeAsset);
    const feeAmount = getSideSwapFeeAmount(quote);
    const rate = lbtcSats > 0 ? receiveAmount / lbtcSats : 0;
    cachedEstimate = {
        lbtcSats,
        receiveAmount,
        feeAmount,
        feeAsset,
        rate,
        updatedAt: Date.now(),
    };
    return {
        receiveAmount,
        feeAmount,
        feeAsset,
        rate,
    };
};

export const estimateSideSwapSend = async (
    usdtSats: number,
): Promise<number> => {
    if (usdtSats <= 0) return 0;

    const { quote, feeAsset } = await requestSideSwapQuote({
        assetType: "Quote",
        amount: usdtSats,
        tradeDir: "Buy",
    });

    return getSideSwapBuyQuoteDeliverAmount(quote, feeAsset);
};

export const executeSideSwapTrade = async (
    utxos: SideSwapUtxo[],
    lbtcAmount: number,
    receiveAddress: string,
    changeAddress: string,
    signPset: (psetBase64: string) => Promise<string>,
    minQuoteAmount?: number,
): Promise<{ txid: string; quoteAmount: number }> => {
    const minimum = await getSideSwapMinimumLbtcSats();
    if (lbtcAmount < minimum) {
        throw new Error(
            `Amount ${lbtcAmount} sats is below SideSwap minimum of ${minimum} sats`,
        );
    }

    const assetPair = getSideSwapAssetPair();
    if (!assetPair) {
        throw new Error("SideSwap asset pair not configured");
    }

    const client = getSideSwapClient();
    await client.connect();

    let executionQuoteActive = false;
    const stopExecutionQuote = () => {
        if (!executionQuoteActive) {
            return;
        }
        executionQuoteActive = false;
        client.stopQuotes();
    };

    const requestExecutionQuote = () =>
        new Promise<{
            quote: SideSwapQuoteSuccess;
            feeAsset: SideSwapFeeAsset;
        }>((resolve, reject) => {
            let errorCount = 0;
            let lastError = "";
            let feeAsset: SideSwapFeeAsset | undefined;
            let quoteSubId: number | undefined;
            let settled = false;

            const timeout = setTimeout(() => {
                rejectQuote(new Error(lastError || "SideSwap quote timeout"));
            }, RPC_TIMEOUT_MS);

            const cleanupQuote = client.onQuote((q, notification) => {
                if (notification.quote_sub_id !== quoteSubId) {
                    return;
                }

                resolveQuote(q);
            });

            const cleanupError = client.onQuoteError(
                (errorMsg, notification) => {
                    if (notification.quote_sub_id !== quoteSubId) {
                        return;
                    }

                    errorCount++;
                    lastError = errorMsg;
                    if (errorCount >= 5) {
                        rejectQuote(new Error(errorMsg));
                    }
                },
            );

            function cleanup() {
                clearTimeout(timeout);
                cleanupQuote();
                cleanupError();
            }

            function resolveQuote(quote: SideSwapQuoteSuccess) {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve({ quote, feeAsset: feeAsset ?? "Base" });
            }

            function rejectQuote(error: Error) {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                reject(error);
            }

            client
                .startQuotes({
                    assetPair,
                    assetType: "Base",
                    amount: lbtcAmount,
                    tradeDir: "Sell",
                    utxos,
                    receiveAddress,
                    changeAddress,
                })
                .then((res) => {
                    if (settled) {
                        client.stopQuotes();
                        return;
                    }
                    quoteSubId = res.quote_sub_id;
                    feeAsset = res.fee_asset;
                    executionQuoteActive = true;
                })
                .catch((e) => {
                    rejectQuote(e instanceof Error ? e : new Error(String(e)));
                });
        });

    const requestExecutionQuoteWithRetry = async (): Promise<{
        quote: SideSwapQuoteSuccess;
        feeAsset: SideSwapFeeAsset;
    }> => {
        const startedAt = Date.now();
        let attempt = 0;

        while (true) {
            try {
                return await requestExecutionQuote();
            } catch (e) {
                stopExecutionQuote();

                if (
                    !isSideSwapWalletSyncError(e) ||
                    Date.now() - startedAt >= UTXO_SYNC_MAX_WAIT_MS
                ) {
                    throw e;
                }

                attempt++;
                log.warn(
                    "SideSwap wallet has not synced temp UTXO yet; retrying",
                    {
                        attempt,
                        retryDelayMs: UTXO_SYNC_RETRY_DELAY_MS,
                        maxWaitMs: UTXO_SYNC_MAX_WAIT_MS,
                    },
                );
                await delay(UTXO_SYNC_RETRY_DELAY_MS);
                await client.connect();
            }
        }
    };

    try {
        const { quote, feeAsset } = await requestExecutionQuoteWithRetry();
        const quoteAmount = getSideSwapSellBaseReceiveAmount(quote, feeAsset);

        if (
            minQuoteAmount !== undefined &&
            quoteAmount < Math.floor(minQuoteAmount)
        ) {
            throw new Error(
                `SideSwap quote ${quoteAmount} is below minimum ${Math.floor(minQuoteAmount)}`,
            );
        }

        log.info("SideSwap execution quote received:", {
            quoteId: quote.quote_id,
            baseAmount: quote.base_amount,
            quoteAmount,
            fee: getSideSwapFeeAmount(quote),
            ttl: quote.ttl,
        });

        const quoteResponse = await client.getQuote(quote.quote_id);
        const signedPset = await signPset(quoteResponse.pset);
        const result = await client.takerSign(quote.quote_id, signedPset);

        log.info("SideSwap trade executed:", result.txid);

        return {
            txid: result.txid,
            quoteAmount,
        };
    } finally {
        stopExecutionQuote();
    }
};
