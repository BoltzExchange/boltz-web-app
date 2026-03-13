import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { SwapStatusUpdate } from "../src/public/apiTypes";
import { init } from "../src/public/config";
import { BoltzWs, waitForStatusWs } from "../src/public/ws";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type MockWsInstance = {
    url: string;
    readyState: number;
    onopen: (() => void) | null;
    onclose: ((event: { reason?: string }) => void) | null;
    onerror: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
};

let mockWsInstance: MockWsInstance;
let constructorCalls: number;

class MockWebSocket {
    static OPEN = 1;

    url: string;
    readyState = 1;
    onopen: (() => void) | null = null;
    onclose: ((event: { reason?: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    send = vi.fn();
    close = vi.fn().mockImplementation(function (this: MockWebSocket) {
        this.readyState = 3;
        this.onclose?.({ reason: "" });
    });

    constructor(url: string) {
        this.url = url;
        constructorCalls++;
        mockWsInstance = this as unknown as MockWsInstance;

        setTimeout(() => {
            this.readyState = 1;
            this.onopen?.();
        }, 0);
    }
}

beforeEach(() => {
    constructorCalls = 0;
    init({ apiUrl: "http://localhost:9001" });

    // @ts-expect-error -- replace global WebSocket with mock
    globalThis.WebSocket = MockWebSocket;
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const simulateMessage = (data: object) => {
    mockWsInstance.onmessage?.({ data: JSON.stringify(data) });
};

const makeUpdate = (
    id: string,
    status: string,
    extra: Partial<SwapStatusUpdate> = {},
): SwapStatusUpdate => ({
    id,
    status,
    ...extra,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BoltzWs", () => {
    test("connects to the correct URL", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(constructorCalls).toBe(1));
        expect(mockWsInstance.url).toBe("ws://localhost:9001/v2/ws");
    });

    test("converts https to wss", async () => {
        const ws = new BoltzWs({ apiUrl: "https://api.boltz.exchange" });
        ws.connect();
        await vi.waitFor(() => expect(constructorCalls).toBe(1));
        expect(mockWsInstance.url).toBe("wss://api.boltz.exchange/v2/ws");
    });

    test("subscribes tracked IDs on connect", async () => {
        const ws = new BoltzWs();
        ws.subscribe(["swap1", "swap2"]);
        ws.connect();

        await vi.waitFor(() => expect(mockWsInstance.send).toHaveBeenCalled());

        const sent = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
        expect(sent).toEqual({
            op: "subscribe",
            channel: "swap.update",
            args: ["swap1", "swap2"],
        });
    });

    test("subscribes new IDs while connected", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onopen).not.toBeNull());

        // Wait for onopen to fire
        await vi.waitFor(() => expect(mockWsInstance.readyState).toBe(1));

        ws.subscribe(["swap3"]);

        await vi.waitFor(() => expect(mockWsInstance.send).toHaveBeenCalled());
        const sent = JSON.parse(
            mockWsInstance.send.mock.calls[
                mockWsInstance.send.mock.calls.length - 1
            ][0],
        );
        expect(sent).toEqual({
            op: "subscribe",
            channel: "swap.update",
            args: ["swap3"],
        });
    });

    test("does not re-subscribe already tracked IDs", async () => {
        const ws = new BoltzWs();
        ws.subscribe(["swap1"]);
        ws.connect();

        await vi.waitFor(() =>
            expect(mockWsInstance.send).toHaveBeenCalledTimes(1),
        );

        ws.subscribe(["swap1"]);
        // Should not send again
        expect(mockWsInstance.send).toHaveBeenCalledTimes(1);
    });

    test("unsubscribes IDs", async () => {
        const ws = new BoltzWs();
        ws.subscribe(["swap1", "swap2"]);
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.send).toHaveBeenCalled());

        ws.unsubscribe(["swap1"]);

        const sent = JSON.parse(
            mockWsInstance.send.mock.calls[
                mockWsInstance.send.mock.calls.length - 1
            ][0],
        );
        expect(sent).toEqual({
            op: "unsubscribe",
            channel: "swap.update",
            args: ["swap1"],
        });
        expect(ws.subscribedIds.has("swap1")).toBe(false);
        expect(ws.subscribedIds.has("swap2")).toBe(true);
    });

    test("emits update events for swap.update messages", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("id1", "swap.created")],
            timestamp: "123",
        });

        expect(updates).toHaveLength(1);
        expect(updates[0]).toEqual({ id: "id1", status: "swap.created" });
    });

    test("emits multiple updates from a single message", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [
                makeUpdate("id1", "swap.created"),
                makeUpdate("id2", "invoice.set"),
            ],
            timestamp: "123",
        });

        expect(updates).toHaveLength(2);
        expect(updates[0].id).toBe("id1");
        expect(updates[1].id).toBe("id2");
    });

    test("ignores ping/pong messages", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({ event: "pong" });
        simulateMessage({ event: "ping" });

        expect(updates).toHaveLength(0);
    });

    test("ignores subscribe confirmation messages", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "subscribe",
            channel: "swap.update",
            args: ["swap1"],
            timestamp: "123",
        });

        expect(updates).toHaveLength(0);
    });

    test("emits open event", async () => {
        const ws = new BoltzWs();
        const opened = vi.fn();
        ws.on("open", opened);
        ws.connect();

        await vi.waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    });

    test("emits close event", async () => {
        const ws = new BoltzWs({ reconnectInterval: 0 });
        const closed = vi.fn();
        ws.on("close", closed);
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onclose).not.toBeNull());

        mockWsInstance.onclose?.({ reason: "test" });

        expect(closed).toHaveBeenCalledWith("test");
    });

    test("close() prevents auto-reconnect", async () => {
        vi.useFakeTimers();

        const ws = new BoltzWs({ reconnectInterval: 100 });
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.close).toBeDefined());

        ws.close();

        vi.advanceTimersByTime(200);
        // Should only have created 1 WebSocket (the initial connect)
        expect(constructorCalls).toBe(1);

        vi.useRealTimers();
    });

    test("on() returns unsubscribe function", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        const unsub = ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("id1", "swap.created")],
            timestamp: "123",
        });
        expect(updates).toHaveLength(1);

        unsub();

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("id2", "invoice.set")],
            timestamp: "124",
        });
        expect(updates).toHaveLength(1); // No new update
    });

    test("connected reflects WebSocket state", async () => {
        const ws = new BoltzWs();
        expect(ws.connected).toBe(false);

        ws.connect();
        await vi.waitFor(() => expect(ws.connected).toBe(true));
    });

    test("handles malformed JSON messages gracefully", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        mockWsInstance.onmessage?.({ data: "not json" });

        expect(updates).toHaveLength(0);
    });

    test("preserves transaction data in updates", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [
                makeUpdate("id1", "transaction.mempool", {
                    transaction: { id: "tx123", hex: "deadbeef", eta: 600 },
                }),
            ],
            timestamp: "123",
        });

        expect(updates[0].transaction).toEqual({
            id: "tx123",
            hex: "deadbeef",
            eta: 600,
        });
    });

    test("preserves failure details in updates", async () => {
        const ws = new BoltzWs();
        const updates: SwapStatusUpdate[] = [];
        ws.on("update", (u) => updates.push(u));
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [
                makeUpdate("id1", "transaction.lockupFailed", {
                    failureReason: "locked wrong amount",
                    failureDetails: { expected: 100000, actual: 50000 },
                }),
            ],
            timestamp: "123",
        });

        expect(updates[0].failureReason).toBe("locked wrong amount");
        expect(updates[0].failureDetails).toEqual({
            expected: 100000,
            actual: 50000,
        });
    });
});

describe("BoltzWs.onSwapStatus", () => {
    test("fires callback on matching swap+status", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        const cb = vi.fn();
        ws.onSwapStatus("swap1", ["transaction.mempool"], cb);

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "1",
        });

        expect(cb).toHaveBeenCalledOnce();
        expect(cb.mock.calls[0][0].status).toBe("transaction.mempool");
    });

    test("auto-subscribes to the swap ID", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.send).toBeDefined());
        await vi.waitFor(() => expect(ws.connected).toBe(true));

        ws.onSwapStatus("swap42", ["x"], vi.fn());

        await vi.waitFor(() => expect(mockWsInstance.send).toHaveBeenCalled());
        const sent = JSON.parse(
            mockWsInstance.send.mock.calls[
                mockWsInstance.send.mock.calls.length - 1
            ][0],
        );
        expect(sent.args).toContain("swap42");
    });

    test("ignores updates for other swaps", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        const cb = vi.fn();
        ws.onSwapStatus("swap1", ["transaction.mempool"], cb);

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap2", "transaction.mempool")],
            timestamp: "1",
        });

        expect(cb).not.toHaveBeenCalled();
    });

    test("ignores non-matching statuses", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        const cb = vi.fn();
        ws.onSwapStatus("swap1", ["transaction.claimed"], cb);

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "swap.created")],
            timestamp: "1",
        });

        expect(cb).not.toHaveBeenCalled();
    });

    test("fires only once (one-shot)", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        const cb = vi.fn();
        ws.onSwapStatus("swap1", ["transaction.mempool"], cb);

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "1",
        });
        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "2",
        });

        expect(cb).toHaveBeenCalledOnce();
    });

    test("returns cancel function", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        const cb = vi.fn();
        const cancel = ws.onSwapStatus("swap1", ["transaction.mempool"], cb);

        cancel();

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "1",
        });

        expect(cb).not.toHaveBeenCalled();
    });
});

describe("BoltzWs.waitForStatus", () => {
    test("resolves on matching status", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        const promise = ws.waitForStatus("swap1", ["transaction.mempool"]);

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "1",
        });

        const result = await promise;
        expect(result.id).toBe("swap1");
        expect(result.status).toBe("transaction.mempool");
    });

    test("rejects on timeout", async () => {
        vi.useFakeTimers();

        const ws = new BoltzWs();
        ws.connect();
        await vi.advanceTimersByTimeAsync(10);

        const promise = ws.waitForStatus("swap1", ["never"], 500);

        vi.advanceTimersByTime(600);

        await expect(promise).rejects.toThrow(
            "did not reach status [never] within 500ms",
        );

        vi.useRealTimers();
    });

    test("auto-subscribes to the swap ID", async () => {
        const ws = new BoltzWs();
        ws.connect();
        await vi.waitFor(() => expect(ws.connected).toBe(true));

        const promise = ws.waitForStatus("swap99", ["x"], 2_000);

        await vi.waitFor(() =>
            expect(ws.subscribedIds.has("swap99")).toBe(true),
        );

        // Clean up
        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap99", "x")],
            timestamp: "1",
        });
        await promise;
    });
});

describe("waitForStatusWs (standalone)", () => {
    test("resolves when target status is received", async () => {
        const promise = waitForStatusWs(
            "swap1",
            ["transaction.mempool"],
            5_000,
        );

        // Wait for the WS to be created and connected
        await vi.waitFor(() => expect(mockWsInstance).toBeDefined());
        await vi.waitFor(() => expect(mockWsInstance.onmessage).not.toBeNull());

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "123",
        });

        const result = await promise;
        expect(result.id).toBe("swap1");
        expect(result.status).toBe("transaction.mempool");
    });

    test("ignores updates for other swap IDs", async () => {
        const promise = waitForStatusWs(
            "swap1",
            ["transaction.mempool"],
            2_000,
        );

        await vi.waitFor(() =>
            expect(mockWsInstance?.onmessage).not.toBeNull(),
        );

        // Send update for a different swap
        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap2", "transaction.mempool")],
            timestamp: "123",
        });

        // Then send the correct one
        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "124",
        });

        const result = await promise;
        expect(result.id).toBe("swap1");
    });

    test("ignores non-matching statuses", async () => {
        const promise = waitForStatusWs(
            "swap1",
            ["transaction.claimed"],
            2_000,
        );

        await vi.waitFor(() =>
            expect(mockWsInstance?.onmessage).not.toBeNull(),
        );

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "swap.created")],
            timestamp: "123",
        });

        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.claimed")],
            timestamp: "124",
        });

        const result = await promise;
        expect(result.status).toBe("transaction.claimed");
    });

    test("rejects on timeout", async () => {
        vi.useFakeTimers();

        const promise = waitForStatusWs("swap1", ["never.happens"], 1_000);

        // Let the WS connect
        await vi.advanceTimersByTimeAsync(10);

        // Advance past timeout
        vi.advanceTimersByTime(1_100);

        await expect(promise).rejects.toThrow(
            "did not reach status [never.happens] within 1000ms",
        );

        vi.useRealTimers();
    });

    test("subscribes to the swap ID", async () => {
        const promise = waitForStatusWs("swap1", ["transaction.mempool"]);

        await vi.waitFor(() => expect(mockWsInstance?.send).toHaveBeenCalled());

        const sent = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
        expect(sent.args).toEqual(["swap1"]);

        // Clean up
        simulateMessage({
            event: "update",
            channel: "swap.update",
            args: [makeUpdate("swap1", "transaction.mempool")],
            timestamp: "123",
        });
        await promise;
    });
});
