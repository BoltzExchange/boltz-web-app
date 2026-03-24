import { networks as LiquidNetworks, payments } from "liquidjs-lib";
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
    fee_asset: string;
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
    fee_asset: string;
    quote_sub_id: number;
};

type PendingRequest<T> = {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

type QuoteListener = (quote: SideSwapQuoteSuccess) => void;

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

            if (msg.method === "market" && msg.params?.quote) {
                const notification =
                    msg.params.quote as SideSwapQuoteNotification;
                const status = notification.status;

                if ("Success" in status) {
                    for (const listener of this.quoteListeners) {
                        try {
                            listener(status.Success);
                        } catch (e) {
                            log.error("SideSwap quote listener error:", e);
                        }
                    }
                } else if ("LowBalance" in status) {
                    log.warn("SideSwap LowBalance:", status.LowBalance);
                    for (const listener of this.quoteListeners) {
                        try {
                            listener(status.LowBalance);
                        } catch (e) {
                            log.error("SideSwap quote listener error:", e);
                        }
                    }
                } else if ("Error" in status) {
                    log.warn("SideSwap quote error:", status.Error.error_msg);
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
        const result = await this.rpc<{ list_markets: { markets: SideSwapMarket[] } }>(
            "market",
            { list_markets: {} },
        );
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
    }

    stopQuotes(): void {
        this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
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

const DUMMY_PUBKEY = Buffer.from(
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "hex",
);

const getPlaceholderAddress = (): string => {
    const network = getLiquidNetwork();
    const { address } = payments.p2wpkh({
        pubkey: DUMMY_PUBKEY,
        network,
    });
    return address!;
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

        const cleanup = client.onQuote((quote: SideSwapQuoteSuccess) => {
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
                feeAmount: quote.server_fee + quote.fixed_fee,
                rate,
            });
        });

        const placeholderAddr = getPlaceholderAddress();
        client
            .startQuotes({
                assetPair,
                assetType: "Base",
                amount: lbtcSats,
                tradeDir: "Sell",
                receiveAddress: placeholderAddr,
                changeAddress: placeholderAddr,
            })
            .catch((e) => {
                clearTimeout(timeout);
                cleanup();
                reject(e);
            });
    }).finally(() => {
        client.stopQuotes();
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
    lbtcAmount: number,
    receiveAddress: string,
    changeAddress: string,
    signPset: (psetBase64: string) => Promise<string>,
): Promise<{ txid: string; quoteAmount: number }> => {
    const assetPair = getSideSwapAssetPair();
    if (!assetPair) {
        throw new Error("SideSwap asset pair not configured");
    }

    const client = getSideSwapClient();
    await client.connect();

    const quote = await new Promise<SideSwapQuoteSuccess>(
        (resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error("SideSwap quote timeout during execution"));
            }, RPC_TIMEOUT_MS);

            const cleanup = client.onQuote((q) => {
                clearTimeout(timeout);
                cleanup();
                resolve(q);
            });

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
                .catch((e) => {
                    clearTimeout(timeout);
                    cleanup();
                    reject(e);
                });
        },
    );

    log.info("SideSwap execution quote received:", {
        quoteId: quote.quote_id,
        baseAmount: quote.base_amount,
        quoteAmount: quote.quote_amount,
        fee: quote.server_fee + quote.fixed_fee,
        ttl: quote.ttl,
    });

    const quoteResponse = await client.getQuote(quote.quote_id);

    const signedPset = await signPset(quoteResponse.pset);

    const result = await client.takerSign(quote.quote_id, signedPset);

    log.info("SideSwap trade executed:", result.txid);

    client.stopQuotes();

    return {
        txid: result.txid,
        quoteAmount: quote.quote_amount,
    };
};
