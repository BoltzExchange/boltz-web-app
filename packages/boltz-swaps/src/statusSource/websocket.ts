import { getBoltzApiUrl } from "../config.ts";
import { getLogger } from "../logger.ts";
import { safeEmit, safeEmitError } from "./emit.ts";
import type {
    StatusErrorHandler,
    StatusSource,
    StatusUpdateHandler,
    SwapUpdate,
    Unsubscribe,
} from "./types.ts";

// Minimal structural shape both the browser global `WebSocket` and Node's `ws`
// satisfy, so we never need a hard `ws` dependency or `@types/ws`.
export type WebSocketLike = {
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    onopen: ((event: unknown) => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onclose: ((event: { wasClean?: boolean }) => void) | null;
    onerror: ((event: unknown) => void) | null;
};
export type WebSocketConstructor = new (url: string) => WebSocketLike;

export type ReconnectOptions = {
    initialDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
    // Jitter fraction (0..1) applied to each delay. Default 0.5.
    jitter?: number;
    // Activate the polling fallback after this many failed connects. Default 3.
    fallbackAfterAttempts?: number;
};

export type WebSocketStatusSourceOptions = {
    // Defaults to globalThis.WebSocket. Node < 22: pass `(await import("ws")).default`.
    webSocketImpl?: WebSocketConstructor;
    // Backoff policy, or false to disable auto-reconnect.
    reconnect?: ReconnectOptions | false;
    // Serves updates while the WebSocket is down (e.g. createPollingStatusSource()).
    fallback?: StatusSource;
    // Force-reconnect a socket that hasn't opened within this many ms. Default 15000.
    connectTimeoutMs?: number;
    // Ping interval once open; an unanswered interval force-reconnects. Default 15000, 0 disables.
    pingIntervalMs?: number;
};

const WS_OPEN = 1;
const CHANNEL = "swap.update";

const formatWsUrl = (url: string): string =>
    url.replace("http://", "ws://").replace("https://", "wss://");

const toFrame = (data: unknown): string =>
    typeof data === "string"
        ? data
        : (data as { toString(): string }).toString();

type ResolvedReconnect = Required<ReconnectOptions>;

const resolveReconnect = (
    reconnect: ReconnectOptions | false | undefined,
): ResolvedReconnect | false => {
    if (reconnect === false) {
        return false;
    }
    return {
        initialDelayMs: 1_000,
        maxDelayMs: 30_000,
        factor: 2,
        jitter: 0.5,
        fallbackAfterAttempts: 3,
        ...(reconnect ?? {}),
    };
};

// WebSocket StatusSource: one multiplexed socket to /v2/ws. Routes each
// `swap.update` to its id's subscribers. Degrades to `fallback` if down.
export const createWebSocketStatusSource = (
    options: WebSocketStatusSourceOptions = {},
): StatusSource => {
    const reconnect = resolveReconnect(options.reconnect);
    const fallback = options.fallback;
    const connectTimeoutMs = options.connectTimeoutMs ?? 15_000;
    const pingIntervalMs = options.pingIntervalMs ?? 15_000;

    const subscribers = new Map<string, Set<StatusUpdateHandler>>();
    const errorHandlers = new Map<string, Set<StatusErrorHandler>>();
    const lastUpdate = new Map<string, SwapUpdate>();
    const fallbackUnsubs = new Map<string, Unsubscribe>();

    let constructor: WebSocketConstructor | null | undefined;
    let ws: WebSocketLike | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let awaitingPong = false;
    let attempt = 0;
    let fallbackActive = false;
    let sourceClosed = false;

    const resolveConstructor = (): WebSocketConstructor | null => {
        if (constructor === undefined) {
            constructor =
                options.webSocketImpl ??
                (globalThis as { WebSocket?: WebSocketConstructor })
                    .WebSocket ??
                null;
        }
        return constructor;
    };

    const dispatch = (update: SwapUpdate): void => {
        const handlers = subscribers.get(update.id);
        if (handlers === undefined) {
            // A late frame for an already-unsubscribed id: drop it without
            // recording lastUpdate, so cleaned-up ids don't leak entries.
            return;
        }
        lastUpdate.set(update.id, update);
        for (const handler of handlers) {
            safeEmit(handler, update);
        }
    };

    const emitError = (id: string, error: unknown): void => {
        const handlers = errorHandlers.get(id);
        if (handlers === undefined) {
            return;
        }
        safeEmitError(handlers, error, id);
    };

    const startFallback = (id: string): void => {
        if (fallback === undefined || fallbackUnsubs.has(id)) {
            return;
        }
        fallbackUnsubs.set(
            id,
            fallback.subscribe(id, dispatch, (error) => emitError(id, error)),
        );
    };

    const activateFallback = (): void => {
        if (fallbackActive || fallback === undefined) {
            return;
        }
        fallbackActive = true;
        getLogger().warn("WebSocket status source degraded to polling");
        for (const id of subscribers.keys()) {
            startFallback(id);
        }
    };

    const deactivateFallback = (): void => {
        if (!fallbackActive) {
            return;
        }
        fallbackActive = false;
        for (const unsubscribe of fallbackUnsubs.values()) {
            unsubscribe();
        }
        fallbackUnsubs.clear();
    };

    const send = (op: "subscribe" | "unsubscribe", ids: string[]): void => {
        if (ids.length === 0 || ws === undefined || ws.readyState !== WS_OPEN) {
            return;
        }
        ws.send(JSON.stringify({ op, channel: CHANNEL, args: ids }));
    };

    const handleMessage = (data: unknown): void => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(toFrame(data));
        } catch (e) {
            getLogger().warn("WebSocket status: unparseable frame", e);
            return;
        }
        const message = parsed as {
            event?: string;
            channel?: string;
            args?: unknown[];
        };
        if (message.event === "ping" || message.event === "pong") {
            return;
        }
        if (
            message.event !== "update" ||
            message.channel !== CHANNEL ||
            !Array.isArray(message.args)
        ) {
            return;
        }
        for (const arg of message.args) {
            const update = arg as SwapUpdate;
            if (
                update === null ||
                typeof update !== "object" ||
                typeof update.id !== "string" ||
                typeof update.status !== "string"
            ) {
                continue;
            }
            dispatch({
                id: update.id,
                status: update.status,
                failureReason: update.failureReason,
                zeroConfRejected: update.zeroConfRejected,
                transaction: update.transaction,
            });
        }
    };

    const clearOpenTimer = (): void => {
        if (openTimer !== undefined) {
            clearTimeout(openTimer);
            openTimer = undefined;
        }
    };

    const stopPinging = (): void => {
        if (pingTimer !== undefined) {
            clearInterval(pingTimer);
            pingTimer = undefined;
        }
        awaitingPong = false;
    };

    // Heartbeat: ping each interval; any inbound frame clears `awaitingPong`, so
    // only a silent socket trips it, force-reconnecting it (catches half-open).
    const startPinging = (socket: WebSocketLike): void => {
        stopPinging();
        if (pingIntervalMs <= 0) {
            return;
        }
        pingTimer = setInterval(() => {
            if (ws !== socket || socket.readyState !== WS_OPEN) {
                return;
            }
            if (awaitingPong) {
                getLogger().warn(
                    "WebSocket status: ping unanswered; reconnecting",
                );
                socket.close();
                handleDisconnect(socket);
                return;
            }
            awaitingPong = true;
            socket.send(JSON.stringify({ op: "ping" }));
        }, pingIntervalMs);
    };

    // Drop the socket if it's still current and reconnect. The `ws !== socket`
    // guard ignores superseded sockets (a stale close can't spawn a reconnect).
    const handleDisconnect = (socket: WebSocketLike): void => {
        if (ws !== socket) {
            return;
        }
        clearOpenTimer();
        stopPinging();
        ws = undefined;
        if (reconnect === false) {
            // Not reconnecting: degrade to the fallback (if any) for good
            // rather than going silently dark.
            activateFallback();
            return;
        }
        scheduleReconnect();
    };

    const scheduleReconnect = (): void => {
        if (reconnect === false || sourceClosed || subscribers.size === 0) {
            return;
        }
        attempt += 1;
        if (attempt >= reconnect.fallbackAfterAttempts) {
            activateFallback();
        }
        const ceiling = Math.min(
            reconnect.maxDelayMs,
            reconnect.initialDelayMs * reconnect.factor ** (attempt - 1),
        );
        const delay = ceiling * (1 - reconnect.jitter * Math.random());
        if (reconnectTimer !== undefined) {
            clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            connect();
        }, delay);
    };

    const connect = (): void => {
        if (
            sourceClosed ||
            ws !== undefined ||
            reconnectTimer !== undefined ||
            subscribers.size === 0
        ) {
            return;
        }
        const ctor = resolveConstructor();
        if (ctor === null) {
            activateFallback();
            return;
        }

        const socket = new ctor(formatWsUrl(getBoltzApiUrl()) + "/v2/ws");
        ws = socket;
        openTimer = setTimeout(() => {
            openTimer = undefined;
            getLogger().warn("WebSocket status: connect timed out");
            socket.close();
            handleDisconnect(socket);
        }, connectTimeoutMs);

        // Ignore events from a socket we've abandoned (e.g. connect-timeout
        // closed it): a late onopen/onmessage would corrupt backoff/lastUpdate.
        socket.onopen = (): void => {
            if (ws !== socket) {
                return;
            }
            clearOpenTimer();
            attempt = 0;
            deactivateFallback();
            send("subscribe", Array.from(subscribers.keys()));
            startPinging(socket);
        };
        socket.onmessage = (event): void => {
            if (ws !== socket) {
                return;
            }
            // Any inbound frame proves the connection is alive.
            awaitingPong = false;
            handleMessage(event.data);
        };
        socket.onerror = (event): void => {
            if (ws !== socket) {
                return;
            }
            getLogger().error("WebSocket status source error", event);
        };
        socket.onclose = (): void => handleDisconnect(socket);
    };

    const cleanup = (id: string): void => {
        subscribers.delete(id);
        errorHandlers.delete(id);
        lastUpdate.delete(id);
        const unsubscribe = fallbackUnsubs.get(id);
        if (unsubscribe !== undefined) {
            unsubscribe();
            fallbackUnsubs.delete(id);
        }
        send("unsubscribe", [id]);
        if (subscribers.size === 0) {
            // Reset to a clean, non-degraded state so a later subscriber starts
            // fresh rather than inheriting a stale high backoff / degraded flag.
            deactivateFallback();
            attempt = 0;
            if (reconnectTimer !== undefined) {
                clearTimeout(reconnectTimer);
                reconnectTimer = undefined;
            }
            clearOpenTimer();
            stopPinging();
            ws?.close();
            ws = undefined;
        }
    };

    return {
        subscribe(id, onUpdate, onError): Unsubscribe {
            if (sourceClosed) {
                return () => {};
            }
            if (resolveConstructor() === null && fallback === undefined) {
                throw new Error(
                    "No WebSocket implementation available. Pass `webSocketImpl` " +
                        "(e.g. `(await import('ws')).default`) or use createPollingStatusSource.",
                );
            }

            let handlers = subscribers.get(id);
            const isNewId = handlers === undefined || handlers.size === 0;
            const handlerIsNew =
                handlers === undefined || !handlers.has(onUpdate);
            if (handlers === undefined) {
                handlers = new Set();
                subscribers.set(id, handlers);
            }
            handlers.add(onUpdate);
            if (onError !== undefined) {
                let errs = errorHandlers.get(id);
                if (errs === undefined) {
                    errs = new Set();
                    errorHandlers.set(id, errs);
                }
                errs.add(onError);
            }

            connect();
            if (isNewId) {
                // First subscriber for this id: ask the server (it pushes the
                // current status on subscribe) and start fallback if degraded.
                send("subscribe", [id]);
                if (fallbackActive) {
                    startFallback(id);
                }
            } else if (handlerIsNew) {
                // Late joiner to an already-tracked id: hand over the current
                // status immediately. Skipped for an idempotent re-subscribe of
                // a handler already registered, so it isn't replayed.
                const known = lastUpdate.get(id);
                if (known !== undefined) {
                    safeEmit(onUpdate, known);
                }
            }

            return () => {
                const current = subscribers.get(id);
                if (current === undefined) {
                    return;
                }
                current.delete(onUpdate);
                if (onError !== undefined) {
                    errorHandlers.get(id)?.delete(onError);
                }
                if (current.size === 0) {
                    cleanup(id);
                }
            };
        },
        close(): void {
            sourceClosed = true;
            if (reconnectTimer !== undefined) {
                clearTimeout(reconnectTimer);
                reconnectTimer = undefined;
            }
            clearOpenTimer();
            stopPinging();
            deactivateFallback();
            ws?.close();
            ws = undefined;
            subscribers.clear();
            errorHandlers.clear();
            lastUpdate.clear();
        },
    };
};
