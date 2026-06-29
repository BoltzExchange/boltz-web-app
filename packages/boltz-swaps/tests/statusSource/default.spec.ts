import { vi } from "vitest";

import {
    type SwapUpdate,
    createDefaultStatusSource,
} from "../../src/statusSource/index.ts";

const mocks = vi.hoisted(() => ({
    getSwapStatuses: vi.fn(),
    getSwapStatus: vi.fn(),
}));

vi.mock("../../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof import("../../src/client.ts")>()),
    getSwapStatuses: mocks.getSwapStatuses,
    getSwapStatus: mocks.getSwapStatus,
}));

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

    public drop(): void {
        this.readyState = 3;
        this.onclose?.({ wasClean: false });
    }
}

const WebSocketImpl = FakeWebSocket as unknown as new (
    url: string,
) => FakeWebSocket;

const reconnect = {
    initialDelayMs: 100,
    maxDelayMs: 10_000,
    factor: 2,
    jitter: 0,
    fallbackAfterAttempts: 3,
};

beforeEach(() => {
    mocks.getSwapStatuses.mockReset();
    mocks.getSwapStatus.mockReset();
    FakeWebSocket.instances = [];
});

describe("createDefaultStatusSource", () => {
    test("streams over the WebSocket while connected, without polling", () => {
        const source = createDefaultStatusSource({
            webSocketImpl: WebSocketImpl,
            reconnect,
        });
        const seen: SwapUpdate[] = [];
        source.subscribe("a", (update) => seen.push(update));

        FakeWebSocket.instances[0].open();
        FakeWebSocket.instances[0].recv({
            event: "update",
            channel: "swap.update",
            args: [{ id: "a", status: "invoice.set" }],
        });

        expect(seen).toEqual([{ id: "a", status: "invoice.set" }]);
        expect(mocks.getSwapStatuses).not.toHaveBeenCalled();

        source.close?.();
    });

    test("degrades to REST polling on persistent WS failure, then resumes WS", async () => {
        vi.useFakeTimers();
        try {
            mocks.getSwapStatuses.mockResolvedValue({
                a: { status: "transaction.mempool" },
            });
            const source = createDefaultStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect,
                pollIntervalMs: 50,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (update) => seen.push(update));

            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            FakeWebSocket.instances[1].drop();
            await vi.advanceTimersByTimeAsync(200);
            FakeWebSocket.instances[2].drop();
            await vi.advanceTimersByTimeAsync(400);

            // polling fallback delivers the current status (once, since the
            // polling source de-dups unchanged statuses)
            expect(mocks.getSwapStatuses).toHaveBeenCalledWith(["a"]);
            expect(seen.length).toBeGreaterThan(0);
            expect(seen.every((u) => u.status === "transaction.mempool")).toBe(
                true,
            );

            // socket recovers → fallback dropped, WS resumes
            const recovered =
                FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
            recovered.open();
            recovered.recv({
                event: "update",
                channel: "swap.update",
                args: [{ id: "a", status: "transaction.confirmed" }],
            });

            expect(seen[seen.length - 1].status).toBe("transaction.confirmed");
        } finally {
            vi.useRealTimers();
        }
    });

    test("falls back to polling when no WebSocket implementation is available", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("WebSocket", undefined);
        try {
            mocks.getSwapStatuses.mockResolvedValue({
                a: { status: "swap.created" },
            });
            const source = createDefaultStatusSource({
                reconnect,
                pollIntervalMs: 50,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("a", (update) => seen.push(update));

            await vi.advanceTimersByTimeAsync(0);

            expect(FakeWebSocket.instances).toHaveLength(0);
            expect(mocks.getSwapStatuses).toHaveBeenCalledWith(["a"]);
            expect(seen.some((u) => u.status === "swap.created")).toBe(true);
        } finally {
            vi.unstubAllGlobals();
            vi.useRealTimers();
        }
    });

    test("polls every subscribed id in one batch during fallback", async () => {
        vi.useFakeTimers();
        try {
            mocks.getSwapStatuses.mockResolvedValue({
                x: { status: "swap.created" },
                y: { status: "invoice.set" },
                z: { status: "transaction.mempool" },
            });
            const source = createDefaultStatusSource({
                webSocketImpl: WebSocketImpl,
                reconnect,
                pollIntervalMs: 50,
            });
            const seen: SwapUpdate[] = [];
            source.subscribe("x", (update) => seen.push(update));
            source.subscribe("y", (update) => seen.push(update));
            source.subscribe("z", (update) => seen.push(update));

            // 3 failed connects → fallback for every multiplexed id
            FakeWebSocket.instances[0].drop();
            await vi.advanceTimersByTimeAsync(100);
            FakeWebSocket.instances[1].drop();
            await vi.advanceTimersByTimeAsync(200);
            FakeWebSocket.instances[2].drop();
            await vi.advanceTimersByTimeAsync(400);

            expect(mocks.getSwapStatuses).toHaveBeenCalledWith(["x", "y", "z"]);
            expect(new Set(seen.map((u) => u.id))).toEqual(
                new Set(["x", "y", "z"]),
            );
        } finally {
            vi.useRealTimers();
        }
    });
});
