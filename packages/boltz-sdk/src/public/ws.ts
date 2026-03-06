import { resolveValue } from "../internal/utils";
import type { SwapStatusUpdate } from "./apiTypes";
import { getConfig } from "./config";

/** Options for creating a {@link BoltzWs} instance. */
export type BoltzWsOptions = {
    /** Override the API URL from {@link init}. Auto-converts http→ws. */
    apiUrl?: string;
    /** Reconnect interval in ms after an unexpected close. Default: `5000`. Set to `0` to disable. */
    reconnectInterval?: number;
};

/** Map of event names to their listener signatures. */
type EventMap = {
    /** Fired for each swap status update pushed by the server. */
    update: (update: SwapStatusUpdate) => void;
    /** Fired when the WebSocket connection opens. */
    open: () => void;
    /** Fired when the WebSocket connection closes. */
    close: (reason?: string) => void;
    /** Fired on connection or protocol errors. */
    error: (error: Error) => void;
};

const DEFAULT_RECONNECT_INTERVAL = 5_000;

/**
 * Convert an HTTP(S) URL to a WebSocket URL.
 *
 * @param url - The HTTP URL to convert.
 * @returns The equivalent `ws://` or `wss://` URL.
 */
const toWsUrl = (url: string): string =>
    url.replace("http://", "ws://").replace("https://", "wss://");

/**
 * Framework-agnostic WebSocket client for receiving real-time Boltz swap
 * status updates.
 *
 * Uses the Boltz backend `/v2/ws` endpoint and the `swap.update` channel.
 *
 * @example
 * ```ts
 * import { init, BoltzWs, swapStatusPending } from "boltz-sdk";
 *
 * init({ apiUrl: "https://api.boltz.exchange", network: "mainnet" });
 *
 * const ws = new BoltzWs();
 * ws.on("update", (update) => {
 *     console.log(`Swap ${update.id}: ${update.status}`);
 * });
 * ws.connect();
 * ws.subscribe(["swapId"]);
 * ```
 */
export class BoltzWs {
    private ws?: WebSocket;
    private listeners: { [K in keyof EventMap]: Set<EventMap[K]> } = {
        update: new Set(),
        open: new Set(),
        close: new Set(),
        error: new Set(),
    };
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private manualClose = false;
    private ids = new Set<string>();
    private readonly apiUrl: string;
    private readonly reconnectInterval: number;

    constructor(options?: BoltzWsOptions) {
        this.apiUrl = options?.apiUrl ?? resolveValue(getConfig().apiUrl);
        this.reconnectInterval =
            options?.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL;
    }

    /** Whether the WebSocket is currently open. */
    get connected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /** Set of swap IDs currently tracked for updates. */
    get subscribedIds(): ReadonlySet<string> {
        return this.ids;
    }

    /**
     * Open the WebSocket connection.
     *
     * On open, automatically subscribes to all previously added swap IDs.
     * Safe to call multiple times — closes any existing connection first.
     */
    connect(): void {
        this.manualClose = false;
        clearTimeout(this.reconnectTimer);
        this.ws?.close();

        const url = `${toWsUrl(this.apiUrl)}/v2/ws`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.emit("open");

            // Re-subscribe all tracked IDs on (re-)connect
            if (this.ids.size > 0) {
                this.sendSubscribe(Array.from(this.ids));
            }
        };

        this.ws.onclose = (event) => {
            this.emit("close", event.reason || undefined);
            this.scheduleReconnect();
        };

        this.ws.onerror = () => {
            this.emit("error", new Error("WebSocket error"));
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data as string);
        };
    }

    /**
     * Close the connection. Disables auto-reconnect.
     *
     * The tracked swap IDs are preserved — calling {@link connect} again will
     * re-subscribe to them.
     */
    close(): void {
        this.manualClose = true;
        clearTimeout(this.reconnectTimer);
        this.ws?.close();
    }

    /**
     * Subscribe to status updates for one or more swap IDs.
     *
     * Safe to call before {@link connect} — the IDs are tracked and sent on
     * the next (re-)connect.
     *
     * @param ids - Swap identifiers to subscribe to.
     */
    subscribe(ids: string[]): void {
        const newIds = ids.filter((id) => !this.ids.has(id));
        if (newIds.length === 0) return;

        for (const id of newIds) this.ids.add(id);

        if (this.connected) {
            this.sendSubscribe(newIds);
        }
    }

    /**
     * Unsubscribe from status updates for one or more swap IDs.
     *
     * @param ids - Swap identifiers to unsubscribe from.
     */
    unsubscribe(ids: string[]): void {
        const removed = ids.filter((id) => this.ids.has(id));
        if (removed.length === 0) return;

        for (const id of removed) this.ids.delete(id);

        if (this.connected) {
            this.sendUnsubscribe(removed);
        }
    }

    /**
     * Register a listener for an event. Returns an unsubscribe function.
     *
     * @param event - The event name.
     * @param listener - Callback to invoke.
     * @returns A function that removes this listener when called.
     */
    on<K extends keyof EventMap>(event: K, listener: EventMap[K]): () => void {
        (this.listeners[event] as Set<EventMap[K]>).add(listener);
        return () => {
            (this.listeners[event] as Set<EventMap[K]>).delete(listener);
        };
    }

    /**
     * Remove a previously registered listener.
     *
     * @param event - The event name.
     * @param listener - The exact callback reference to remove.
     */
    off<K extends keyof EventMap>(event: K, listener: EventMap[K]): void {
        (this.listeners[event] as Set<EventMap[K]>).delete(listener);
    }

    /**
     * Register a **one-shot** listener that fires when a specific swap
     * reaches one of the target statuses.
     *
     * Auto-subscribes to the swap ID if not already tracked.
     * The listener is removed after the first matching update.
     *
     * @param swapId - The swap to monitor.
     * @param targetStatuses - Status strings to listen for.
     * @param callback - Called with the matching {@link SwapStatusUpdate}.
     * @returns A function that cancels the listener when called.
     *
     * @example
     * ```ts
     * ws.onSwapStatus(swap.id, [swapStatusPending.TransactionMempool], (update) => {
     *     console.log(`TX lockup detected: ${update.transaction?.id}`);
     * });
     * ```
     */
    onSwapStatus(
        swapId: string,
        targetStatuses: string[],
        callback: (update: SwapStatusUpdate) => void,
    ): () => void {
        this.subscribe([swapId]);

        const handler = (update: SwapStatusUpdate) => {
            if (
                update.id === swapId &&
                targetStatuses.includes(update.status)
            ) {
                this.off("update", handler);
                callback(update);
            }
        };

        return this.on("update", handler);
    }

    /**
     * Wait for a swap to reach one of the target statuses.
     *
     * Reuses the current connection (unlike {@link waitForStatusWs} which
     * creates a temporary one). Auto-subscribes to the swap ID.
     *
     * @param swapId - The swap to monitor.
     * @param targetStatuses - Status strings to wait for.
     * @param timeoutMs - Maximum time to wait in ms. Default: `600_000` (10 min).
     * @returns The matching {@link SwapStatusUpdate}.
     *
     * @example
     * ```ts
     * const ws = new BoltzWs();
     * ws.connect();
     * const update = await ws.waitForStatus(swap.id, [
     *     swapStatusPending.TransactionMempool,
     * ]);
     * ```
     */
    waitForStatus(
        swapId: string,
        targetStatuses: string[],
        timeoutMs = 600_000,
    ): Promise<SwapStatusUpdate> {
        return new Promise<SwapStatusUpdate>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | undefined;

            const cancel = this.onSwapStatus(
                swapId,
                targetStatuses,
                (update) => {
                    clearTimeout(timer);
                    resolve(update);
                },
            );

            timer = setTimeout(() => {
                cancel();
                reject(
                    new Error(
                        `Swap ${swapId} did not reach status [${targetStatuses.join(", ")}] within ${timeoutMs}ms`,
                    ),
                );
            }, timeoutMs);
        });
    }

    // --- Private ---

    private emit<K extends keyof EventMap>(
        event: K,
        ...args: Parameters<EventMap[K]>
    ): void {
        for (const listener of this.listeners[event]) {
            (listener as (...a: Parameters<EventMap[K]>) => void)(...args);
        }
    }

    private sendSubscribe(ids: string[]): void {
        this.ws?.send(
            JSON.stringify({
                op: "subscribe",
                channel: "swap.update",
                args: ids,
            }),
        );
    }

    private sendUnsubscribe(ids: string[]): void {
        this.ws?.send(
            JSON.stringify({
                op: "unsubscribe",
                channel: "swap.update",
                args: ids,
            }),
        );
    }

    private handleMessage(raw: string): void {
        let data: {
            event?: string;
            channel?: string;
            args?: SwapStatusUpdate[];
        };

        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }

        // Ignore ping/pong frames
        if (data.event === "pong" || data.event === "ping") {
            return;
        }

        // Swap status updates
        if (data.event === "update" && data.channel === "swap.update") {
            const updates = data.args;
            if (Array.isArray(updates)) {
                for (const update of updates) {
                    this.emit("update", update);
                }
            }
        }
    }

    private scheduleReconnect(): void {
        if (this.manualClose || this.reconnectInterval === 0) {
            return;
        }

        this.reconnectTimer = setTimeout(
            () => this.connect(),
            this.reconnectInterval,
        );
    }
}

/**
 * Wait for a swap to reach one of the target statuses via WebSocket.
 *
 * Creates a temporary {@link BoltzWs} connection, subscribes to the given
 * swap ID, and resolves when a matching status is received. The connection
 * is automatically cleaned up afterwards.
 *
 * @param swapId - The swap identifier to monitor.
 * @param targetStatuses - Status strings to wait for (e.g. `swapStatusPending.TransactionMempool`).
 * @param timeoutMs - Maximum time to wait in ms. Default: `600_000` (10 minutes).
 * @param options - Optional {@link BoltzWsOptions} for the underlying WebSocket.
 * @returns The full {@link SwapStatusUpdate} that matched.
 *
 * @example
 * ```ts
 * const update = await waitForStatusWs(swap.id, [
 *     swapStatusPending.TransactionMempool,
 * ]);
 * console.log(`TX: ${update.transaction?.id}`);
 * ```
 */
export const waitForStatusWs = (
    swapId: string,
    targetStatuses: string[],
    timeoutMs = 600_000,
    options?: BoltzWsOptions,
): Promise<SwapStatusUpdate> => {
    return new Promise<SwapStatusUpdate>((resolve, reject) => {
        const ws = new BoltzWs(options);
        let timer: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
            clearTimeout(timer);
            ws.close();
        };

        ws.on("update", (update) => {
            if (
                update.id === swapId &&
                targetStatuses.includes(update.status)
            ) {
                cleanup();
                resolve(update);
            }
        });

        ws.on("error", (error) => {
            cleanup();
            reject(error);
        });

        timer = setTimeout(() => {
            cleanup();
            reject(
                new Error(
                    `Swap ${swapId} did not reach status [${targetStatuses.join(", ")}] within ${timeoutMs}ms`,
                ),
            );
        }, timeoutMs);

        ws.subscribe([swapId]);
        ws.connect();
    });
};
