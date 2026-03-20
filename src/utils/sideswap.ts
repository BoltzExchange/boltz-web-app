import { networks as LiquidNetworks } from "liquidjs-lib";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { config } from "../config";

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
    redeem_script?: string;
};

export type SideSwapQuote = {
    quote_id: string;
    base_amount: number;
    quote_amount: number;
    server_fee: number;
    ttl_seconds: number;
};

export type SideSwapMarket = {
    asset_pair: SideSwapAssetPair;
    fee_asset: string;
    min_amount: number;
    max_amount: number;
};

export type SideSwapQuoteResponse = {
    pset: string;
    quote_id: string;
};

export type SideSwapTakerSignResponse = {
    txid: string;
};

type PendingRequest<T> = {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

type QuoteListener = (quote: SideSwapQuote) => void;

const RPC_TIMEOUT_MS = 30_000;
const IDLE_DISCONNECT_MS = 120_000;

class SideSwapClient {
    private ws: WebSocket | null = null;
    private nextId = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private pending = new Map<number, PendingRequest<any>>();
    private quoteListeners = new Set<QuoteListener>();
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

    async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.resetIdleTimer();
            return;
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

            if (msg.method === "market.quote" && msg.params) {
                for (const listener of this.quoteListeners) {
                    try {
                        listener(msg.params as SideSwapQuote);
                    } catch (e) {
                        log.error("SideSwap quote listener error:", e);
                    }
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
        return this.rpc<SideSwapMarket[]>("market.list_markets");
    }

    async startQuotes(
        assetPair: SideSwapAssetPair,
        utxos: SideSwapUtxo[] = [],
    ): Promise<void> {
        this.activeSubscriptions++;
        await this.rpc<null>("market.start_quotes", {
            asset_pair: assetPair,
            utxos,
        });
    }

    async stopQuotes(): Promise<void> {
        this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
        try {
            await this.rpc<null>("market.stop_quotes");
        } catch (e) {
            log.warn("SideSwap stop_quotes error:", e);
        }
        this.resetIdleTimer();
    }

    async getQuote(
        quoteId: string,
        assetPair: SideSwapAssetPair,
        utxos: SideSwapUtxo[],
    ): Promise<SideSwapQuoteResponse> {
        return this.rpc<SideSwapQuoteResponse>("market.get_quote", {
            quote_id: quoteId,
            asset_pair: assetPair,
            utxos,
        });
    }

    async takerSign(
        quoteId: string,
        signedPset: string,
    ): Promise<SideSwapTakerSignResponse> {
        return this.rpc<SideSwapTakerSignResponse>("market.taker_sign", {
            quote_id: quoteId,
            pset: signedPset,
        });
    }

    onQuote(listener: QuoteListener): () => void {
        this.quoteListeners.add(listener);
        return () => this.quoteListeners.delete(listener);
    }
}

let clientInstance: SideSwapClient | null = null;

export const getSideSwapClient = (): SideSwapClient => {
    if (!clientInstance) {
        clientInstance = new SideSwapClient();
    }
    return clientInstance;
};

export type SideSwapEstimate = {
    receiveAmount: number;
    feeAmount: number;
    rate: number;
};

let cachedEstimate: {
    rate: number;
    updatedAt: number;
} | null = null;

const ESTIMATE_CACHE_TTL_MS = 30_000;

export const getSideSwapLbtcAssetId = (): string => {
    const network = getLiquidNetwork();
    return network.assetHash;
};

export const getSideSwapUsdtAssetId = (): string | undefined => {
    const assetConfig = config.assets?.["L-USDt"];
    return assetConfig?.liquidToken?.assetId;
};

export const getSideSwapAssetPair = (): SideSwapAssetPair | undefined => {
    const base = getSideSwapLbtcAssetId();
    const quote = getSideSwapUsdtAssetId();
    if (!quote) return undefined;
    return { base, quote };
};

const getLiquidNetwork = (): LiquidNetwork => {
    const liquidNet =
        config.network === "mainnet" ? "liquid" : config.network;
    return LiquidNetworks[liquidNet] as LiquidNetwork;
};

export const estimateSideSwapReceive = async (
    lbtcSats: number,
): Promise<SideSwapEstimate> => {
    if (lbtcSats <= 0) {
        return { receiveAmount: 0, feeAmount: 0, rate: 0 };
    }

    if (
        cachedEstimate &&
        Date.now() - cachedEstimate.updatedAt < ESTIMATE_CACHE_TTL_MS
    ) {
        const receiveAmount = Math.floor(lbtcSats * cachedEstimate.rate);
        return {
            receiveAmount,
            feeAmount: 0,
            rate: cachedEstimate.rate,
        };
    }

    const assetPair = getSideSwapAssetPair();
    if (!assetPair) {
        throw new Error("SideSwap asset pair not configured");
    }

    const client = getSideSwapClient();
    await client.connect();

    return new Promise<SideSwapEstimate>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("SideSwap quote estimation timeout"));
        }, RPC_TIMEOUT_MS);

        const cleanup = client.onQuote((quote: SideSwapQuote) => {
            clearTimeout(timeout);
            cleanup();

            const rate =
                quote.base_amount > 0
                    ? quote.quote_amount / quote.base_amount
                    : 0;

            cachedEstimate = {
                rate,
                updatedAt: Date.now(),
            };

            const receiveAmount = Math.floor(lbtcSats * rate);
            resolve({
                receiveAmount,
                feeAmount: quote.server_fee,
                rate,
            });
        });

        client.startQuotes(assetPair).catch((e) => {
            clearTimeout(timeout);
            cleanup();
            reject(e);
        });
    }).finally(async () => {
        try {
            await client.stopQuotes();
        } catch {
            // ignore
        }
    });
};

export const estimateSideSwapSend = async (
    usdtSats: number,
): Promise<number> => {
    if (usdtSats <= 0) return 0;

    const estimate = await estimateSideSwapReceive(1_0000_0000);
    if (estimate.rate <= 0) return 0;

    return Math.ceil(usdtSats / estimate.rate);
};

export const executeSideSwapTrade = async (
    utxos: SideSwapUtxo[],
    signPset: (psetBase64: string) => Promise<string>,
): Promise<{ txid: string; quoteAmount: number }> => {
    const assetPair = getSideSwapAssetPair();
    if (!assetPair) {
        throw new Error("SideSwap asset pair not configured");
    }

    const client = getSideSwapClient();
    await client.connect();

    const quote = await new Promise<SideSwapQuote>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("SideSwap quote timeout during execution"));
        }, RPC_TIMEOUT_MS);

        const cleanup = client.onQuote((q) => {
            clearTimeout(timeout);
            cleanup();
            resolve(q);
        });

        client.startQuotes(assetPair, utxos).catch((e) => {
            clearTimeout(timeout);
            cleanup();
            reject(e);
        });
    });

    log.info("SideSwap execution quote received:", {
        quoteId: quote.quote_id,
        baseAmount: quote.base_amount,
        quoteAmount: quote.quote_amount,
        fee: quote.server_fee,
        ttl: quote.ttl_seconds,
    });

    const quoteResponse = await client.getQuote(
        quote.quote_id,
        assetPair,
        utxos,
    );

    const signedPset = await signPset(quoteResponse.pset);

    const result = await client.takerSign(quote.quote_id, signedPset);

    log.info("SideSwap trade executed:", result.txid);

    await client.stopQuotes();

    return {
        txid: result.txid,
        quoteAmount: quote.quote_amount,
    };
};
