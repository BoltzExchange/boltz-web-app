import { vi } from "vitest";

import {
    type StatusErrorHandler,
    type StatusSource,
    type StatusUpdateHandler,
    type SwapUpdate,
    createWebSocketStatusSource,
} from "../../src/statusSource/index.ts";

class FakeWebSocket {
    static instances: FakeWebSocket[] = [];

    public readyState = 0;
    public readonly sent: string[] = [];
    public onopen: ((event: unknown) => void) | null = null;
    public onmessage: ((event: { data: unknown }) => void) | null = null;
    public onclose: ((event: { wasClean?: boolean }) => void) | null = null;
    public onerror: ((event: unknown) => void) | null = null;

    constructor(public readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    public send(data: string): void {
        this.sent.push(data);
    }

    public close(): void {
        this.readyState = 3;
        this.onclose?.({ wasClean: true });
    }

    public open(): void {
        this.readyState = 1;
        this.onopen?.({});
    }

    public recv(message: unknown): void {
        this.onmessage?.({ data: JSON.stringify(message) });
    }

    public recvRaw(data: unknown): void {
        this.onmessage?.({ data });
    }

    public drop(): void {
        this.readyState = 3;
        this.onclose?.({ wasClean: false });
    }

    public lastSent(): unknown {
        return JSON.parse(this.sent[this.sent.length - 1]);
    }
}

const WebSocketImpl = FakeWebSocket as unknown as new (
    url: string,
) => FakeWebSocket;

const update = (id: string, status: string): SwapUpdate => ({ id, status });
const noJitter = {
    initialDelayMs: 100,
    maxDelayMs: 10_000,
    factor: 2,
    jitter: 0,
    fallbackAfterAttempts: 3,
};

beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("createWebSocketStatusSource", () => {
    test("defers the subscribe message until the socket opens", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        source.subscribe("a", () => {});

        const ws = FakeWebSocket.instances[0];
        expect(ws.sent).toHaveLength(0);

        ws.open();
        expect(ws.lastSent()).toEqual({
            op: "subscribe",
            channel: "swap.update",
            args: ["a"],
        });
    });

    test("routes updates to the matching id only, across many consumers", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const a1: SwapUpdate[] = [];
        const a2: SwapUpdate[] = [];
        const b: SwapUpdate[] = [];
        source.subscribe("a", (u) => a1.push(u));
        source.subscribe("a", (u) => a2.push(u));
        source.subscribe("b", (u) => b.push(u));

        expect(FakeWebSocket.instances).toHaveLength(1);
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [update("a", "transaction.mempool")],
        });

        expect(a1).toEqual([update("a", "transaction.mempool")]);
        expect(a2).toEqual([update("a", "transaction.mempool")]);
        expect(b).toEqual([]);
    });

    test("re-delivers identical updates (no de-dup), so retries keep firing", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        const frame = {
            event: "update",
            channel: "swap.update",
            args: [update("a", "transaction.mempool")],
        };
        ws.recv(frame);
        ws.recv(frame);

        expect(seen.map((u) => u.status)).toEqual([
            "transaction.mempool",
            "transaction.mempool",
        ]);
    });

    test("re-delivers the current status to handlers after a reconnect", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (u) => seen.push(u));
            FakeWebSocket.instances[0].open();
            FakeWebSocket.instances[0].recv({
                event: "update",
                channel: "swap.update",
                args: [update("a", "transaction.confirmed")],
            });
            expect(seen).toHaveLength(1);

            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            const reconnected = FakeWebSocket.instances[1];
            reconnected.open();
            reconnected.recv({
                event: "update",
                channel: "swap.update",
                args: [update("a", "transaction.confirmed")],
            });

            expect(seen.map((u) => u.status)).toEqual([
                "transaction.confirmed",
                "transaction.confirmed",
            ]);
        } finally {
            vi.useRealTimers();
        }
    });

    test("replays the current status to a late joiner without a redundant subscribe", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const first: SwapUpdate[] = [];
        source.subscribe("a", (u) => first.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();
        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [update("a", "transaction.mempool")],
        });
        expect(first).toHaveLength(1);

        const sentBefore = ws.sent.length;
        const late: SwapUpdate[] = [];
        source.subscribe("a", (u) => late.push(u));

        expect(late).toEqual([update("a", "transaction.mempool")]);
        expect(ws.sent.length).toBe(sentBefore);
    });

    test("re-subscribing the same handler is a no-op (no replay, no frame)", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        const handler = (u: SwapUpdate): void => {
            seen.push(u);
        };
        source.subscribe("a", handler);
        const ws = FakeWebSocket.instances[0];
        ws.open();
        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [update("a", "transaction.mempool")],
        });
        expect(seen).toHaveLength(1);

        const sentBefore = ws.sent.length;
        source.subscribe("a", handler);

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(ws.sent.length).toBe(sentBefore);
        expect(seen).toHaveLength(1);
    });

    test("ignores ping/pong frames and tolerates a non-string frame", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({ event: "ping" });
        ws.recv({ event: "pong" });
        ws.recvRaw({
            toString: () =>
                JSON.stringify({
                    event: "update",
                    channel: "swap.update",
                    args: [update("a", "invoice.set")],
                }),
        });

        expect(seen).toEqual([update("a", "invoice.set")]);
    });

    test("drops a frame whose status is missing", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [{ id: "a" }],
        });
        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [update("a", "invoice.set")],
        });

        expect(seen.map((u) => u.status)).toEqual(["invoice.set"]);
    });

    test("isolates a throwing subscriber from the others", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const good: SwapUpdate[] = [];
        source.subscribe("a", () => {
            throw new Error("boom");
        });
        source.subscribe("a", (u) => good.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [update("a", "invoice.set")],
        });

        expect(good).toEqual([update("a", "invoice.set")]);
    });

    test("reconnects with growing backoff and re-subscribes all ids", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
            });
            source.subscribe("a", () => {});
            source.subscribe("b", () => {});
            FakeWebSocket.instances[0].open();
            expect(FakeWebSocket.instances).toHaveLength(1);

            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            expect(FakeWebSocket.instances).toHaveLength(2);

            FakeWebSocket.instances[1].drop();
            await vi.advanceTimersByTimeAsync(199);
            expect(FakeWebSocket.instances).toHaveLength(2);
            await vi.advanceTimersByTimeAsync(1);
            expect(FakeWebSocket.instances).toHaveLength(3);

            FakeWebSocket.instances[2].open();
            expect(FakeWebSocket.instances[2].lastSent()).toEqual({
                op: "subscribe",
                channel: "swap.update",
                args: ["a", "b"],
            });
        } finally {
            vi.useRealTimers();
        }
    });

    test("unsubscribes the id and closes the socket when the last id leaves", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const unsubscribe = source.subscribe("a", () => {});
        const ws = FakeWebSocket.instances[0];
        ws.open();

        unsubscribe();

        expect(ws.lastSent()).toEqual({
            op: "unsubscribe",
            channel: "swap.update",
            args: ["a"],
        });
        expect(ws.readyState).toBe(3);
    });

    test("force-reconnects a socket that never opens (connect timeout)", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                connectTimeoutMs: 5_000,
            });
            source.subscribe("a", () => {});
            expect(FakeWebSocket.instances).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(5_000);
            expect(FakeWebSocket.instances[0].readyState).toBe(3);
            await vi.advanceTimersByTimeAsync(100);
            expect(FakeWebSocket.instances).toHaveLength(2);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("ignores late events from a socket the connect timeout abandoned", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                connectTimeoutMs: 5_000,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (u) => seen.push(u));

            const stale = FakeWebSocket.instances[0];
            await vi.advanceTimersByTimeAsync(5_000);
            await vi.advanceTimersByTimeAsync(100);
            expect(FakeWebSocket.instances).toHaveLength(2);

            stale.open();
            stale.recv({
                event: "update",
                channel: "swap.update",
                args: [update("a", "transaction.mempool")],
            });
            expect(seen).toEqual([]);

            await vi.advanceTimersByTimeAsync(5_000);
            expect(FakeWebSocket.instances[1].readyState).toBe(3);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("degrades to the fallback on disconnect when reconnect is disabled", () => {
        const fallbackSubs: { id: string; onUpdate: StatusUpdateHandler }[] =
            [];
        const fallback: StatusSource = {
            subscribe: vi.fn((id, onUpdate) => {
                const entry = { id, onUpdate };
                fallbackSubs.push(entry);
                return () => {
                    const i = fallbackSubs.indexOf(entry);
                    if (i >= 0) fallbackSubs.splice(i, 1);
                };
            }),
        };

        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
            reconnect: false,
            fallback,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();
        ws.drop();

        expect(fallbackSubs.map((s) => s.id)).toEqual(["a"]);
        fallbackSubs[0].onUpdate(update("a", "transaction.mempool"));
        expect(seen).toEqual([update("a", "transaction.mempool")]);
    });

    test("throws when no WebSocket is available and no fallback is given", () => {
        vi.stubGlobal("WebSocket", undefined);
        try {
            const source = createWebSocketStatusSource({});
            expect(() => source.subscribe("a", () => {})).toThrow(
                /No WebSocket implementation/,
            );
        } finally {
            vi.unstubAllGlobals();
        }
    });

    test("a subscribe after close() is a no-op (no socket, no dead handler)", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        source.close?.();

        const seen: SwapUpdate[] = [];
        const unsubscribe = source.subscribe("a", (u) => seen.push(u));

        expect(FakeWebSocket.instances).toHaveLength(0);
        expect(seen).toEqual([]);
        expect(unsubscribe).not.toThrow();
    });

    test("delegates to the fallback when no WebSocket is available", () => {
        const fallbackSubs: { id: string; onUpdate: StatusUpdateHandler }[] =
            [];
        const fallback: StatusSource = {
            subscribe: vi.fn((id, onUpdate) => {
                const entry = { id, onUpdate };
                fallbackSubs.push(entry);
                return () => {
                    const i = fallbackSubs.indexOf(entry);
                    if (i >= 0) fallbackSubs.splice(i, 1);
                };
            }),
        };

        vi.stubGlobal("WebSocket", undefined);
        try {
            const source = createWebSocketStatusSource({ fallback });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (u) => seen.push(u));

            expect(FakeWebSocket.instances).toHaveLength(0);
            expect(fallbackSubs.map((s) => s.id)).toEqual(["a"]);

            fallbackSubs[0].onUpdate(update("a", "transaction.mempool"));
            expect(seen).toEqual([update("a", "transaction.mempool")]);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    test("falls back to polling after persistent connect failures, then recovers", async () => {
        vi.useFakeTimers();
        const fallbackSubs: { id: string; onUpdate: StatusUpdateHandler }[] =
            [];
        const fallback: StatusSource = {
            subscribe: vi.fn((id, onUpdate) => {
                const entry = { id, onUpdate };
                fallbackSubs.push(entry);
                return () => {
                    const i = fallbackSubs.indexOf(entry);
                    if (i >= 0) fallbackSubs.splice(i, 1);
                };
            }),
        };
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                fallback,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (u) => seen.push(u));

            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            FakeWebSocket.instances[1].drop();
            await vi.advanceTimersByTimeAsync(200);
            FakeWebSocket.instances[2].drop();
            await vi.advanceTimersByTimeAsync(400);
            expect(fallbackSubs.map((s) => s.id)).toEqual(["a"]);

            fallbackSubs[0].onUpdate(update("a", "transaction.mempool"));
            expect(seen).toEqual([update("a", "transaction.mempool")]);

            const recovered =
                FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
            recovered.open();
            expect(fallbackSubs).toHaveLength(0);
            recovered.recv({
                event: "update",
                channel: "swap.update",
                args: [update("a", "transaction.confirmed")],
            });
            expect(seen.map((u) => u.status)).toEqual([
                "transaction.mempool",
                "transaction.confirmed",
            ]);
        } finally {
            vi.useRealTimers();
        }
    });

    test("surfaces fallback errors to the subscriber's onError handler", async () => {
        vi.useFakeTimers();
        const fallbackErr: { id: string; onError?: StatusErrorHandler }[] = [];
        const fallback: StatusSource = {
            subscribe: vi.fn((id, _onUpdate, onError) => {
                fallbackErr.push({ id, onError });
                return () => {};
            }),
        };
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                fallback,
            });
            const errors: unknown[] = [];
            source.subscribe(
                "a",
                () => {},
                (error) => errors.push(error),
            );

            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            FakeWebSocket.instances[1].drop();
            await vi.advanceTimersByTimeAsync(200);
            FakeWebSocket.instances[2].drop();
            await vi.advanceTimersByTimeAsync(400);

            fallbackErr[0].onError?.(new Error("poll failed"), "a");

            expect(errors).toHaveLength(1);
            expect((errors[0] as Error).message).toBe("poll failed");
        } finally {
            vi.useRealTimers();
        }
    });

    test("dispatches every update in a multi-update frame", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const a: SwapUpdate[] = [];
        const b: SwapUpdate[] = [];
        source.subscribe("a", (u) => a.push(u));
        source.subscribe("b", (u) => b.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [
                update("a", "invoice.set"),
                update("b", "transaction.mempool"),
            ],
        });

        expect(a).toEqual([update("a", "invoice.set")]);
        expect(b).toEqual([update("b", "transaction.mempool")]);
    });

    test("ignores frames with the wrong event, channel, or non-array args", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({
            event: "snapshot",
            channel: "swap.update",
            args: [update("a", "x")],
        });
        ws.recv({
            event: "update",
            channel: "other.channel",
            args: [update("a", "x")],
        });
        ws.recv({ event: "update", channel: "swap.update", args: { id: "a" } });

        expect(seen).toEqual([]);
    });

    test("skips malformed args but keeps the valid ones in the same frame", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [
                null,
                "not-an-object",
                { id: 1, status: "s" },
                { id: "a", status: 2 },
                update("a", "invoice.set"),
            ],
        });

        expect(seen).toEqual([update("a", "invoice.set")]);
    });

    test("preserves optional update fields through dispatch", () => {
        const source = createWebSocketStatusSource({
            webSocketImpl: WebSocketImpl,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (u) => seen.push(u));
        const ws = FakeWebSocket.instances[0];
        ws.open();

        const full = {
            id: "a",
            status: "transaction.lockupFailed",
            failureReason: "timeout",
            zeroConfRejected: true,
            transaction: { id: "tx1", hex: "deadbeef" },
        };
        ws.recv({
            event: "update",
            channel: "swap.update",
            args: [full],
        });

        expect(seen).toEqual([full]);
    });

    test("resets reconnect backoff after the last subscriber leaves", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
            });
            const unsubscribe = source.subscribe("a", () => {});
            FakeWebSocket.instances[0].open();
            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            expect(FakeWebSocket.instances).toHaveLength(2);
            FakeWebSocket.instances[1].drop();
            await vi.advanceTimersByTimeAsync(200);
            expect(FakeWebSocket.instances).toHaveLength(3);

            unsubscribe();
            source.subscribe("a", () => {});
            const fresh =
                FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
            fresh.drop();
            const before = FakeWebSocket.instances.length;

            await vi.advanceTimersByTimeAsync(100);
            expect(FakeWebSocket.instances).toHaveLength(before + 1);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("createWebSocketStatusSource ping heartbeat", () => {
    const pingCount = (ws: FakeWebSocket): number =>
        ws.sent.filter((s) => s === JSON.stringify({ op: "ping" })).length;

    test("sends a ping on the first interval after the socket opens", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                pingIntervalMs: 15_000,
            });
            source.subscribe("a", () => {});
            const ws = FakeWebSocket.instances[0];
            ws.open();

            expect(pingCount(ws)).toBe(0);
            await vi.advanceTimersByTimeAsync(15_000);
            expect(pingCount(ws)).toBe(1);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("force-reconnects when no traffic answers the ping", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                pingIntervalMs: 15_000,
            });
            source.subscribe("a", () => {});
            const ws = FakeWebSocket.instances[0];
            ws.open();

            await vi.advanceTimersByTimeAsync(15_000);
            expect(pingCount(ws)).toBe(1);
            expect(FakeWebSocket.instances).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(15_000);
            expect(ws.readyState).toBe(3);
            await vi.advanceTimersByTimeAsync(100);
            expect(FakeWebSocket.instances).toHaveLength(2);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("does not reconnect when a pong answers within the interval", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                pingIntervalMs: 15_000,
            });
            source.subscribe("a", () => {});
            const ws = FakeWebSocket.instances[0];
            ws.open();

            await vi.advanceTimersByTimeAsync(15_000);
            ws.recv({ event: "pong" });
            await vi.advanceTimersByTimeAsync(15_000);

            expect(FakeWebSocket.instances).toHaveLength(1);
            expect(pingCount(ws)).toBe(2);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("treats any inbound frame as liveness, not only pongs", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                pingIntervalMs: 15_000,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (u) => seen.push(u));
            const ws = FakeWebSocket.instances[0];
            ws.open();

            await vi.advanceTimersByTimeAsync(15_000);
            ws.recv({
                event: "update",
                channel: "swap.update",
                args: [update("a", "transaction.mempool")],
            });
            expect(seen).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(15_000);
            expect(FakeWebSocket.instances).toHaveLength(1);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("pings the recreated socket after a reconnect", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                pingIntervalMs: 15_000,
            });
            source.subscribe("a", () => {});
            FakeWebSocket.instances[0].open();
            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            const recreated = FakeWebSocket.instances[1];
            recreated.open();

            await vi.advanceTimersByTimeAsync(15_000);
            expect(pingCount(recreated)).toBe(1);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("does not ping or recreate while the socket is not OPEN", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect: noJitter,
                pingIntervalMs: 15_000,
            });
            source.subscribe("a", () => {});
            const ws = FakeWebSocket.instances[0];
            ws.open();

            await vi.advanceTimersByTimeAsync(15_000);
            expect(pingCount(ws)).toBe(1);

            ws.readyState = 2;
            await vi.advanceTimersByTimeAsync(15_000);
            expect(pingCount(ws)).toBe(1);
            expect(FakeWebSocket.instances).toHaveLength(1);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });

    test("stops pinging after close()", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                pingIntervalMs: 15_000,
            });
            source.subscribe("a", () => {});
            const ws = FakeWebSocket.instances[0];
            ws.open();

            source.close?.();
            await vi.advanceTimersByTimeAsync(60_000);

            expect(pingCount(ws)).toBe(0);
            expect(FakeWebSocket.instances).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });

    test("can be disabled with pingIntervalMs: 0", async () => {
        vi.useFakeTimers();
        try {
            const source = createWebSocketStatusSource({
                webSocketImpl: WebSocketImpl,
                pingIntervalMs: 0,
            });
            source.subscribe("a", () => {});
            const ws = FakeWebSocket.instances[0];
            ws.open();

            await vi.advanceTimersByTimeAsync(60_000);
            expect(pingCount(ws)).toBe(0);

            source.close?.();
        } finally {
            vi.useRealTimers();
        }
    });
});
