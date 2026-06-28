import { cleanup, render } from "@solidjs/testing-library";

import { BoltzWebSocket, SwapChecker } from "../../src/components/SwapChecker";

vi.mock("../../src/context/Pay", () => ({
    usePayContext: () => ({
        swap: () => null,
        setSwap: vi.fn(),
        claimSwap: vi.fn().mockResolvedValue(undefined),
        setSwapStatus: vi.fn(),
        setSwapStatusTransaction: vi.fn(),
        setFailureReason: vi.fn(),
        shouldIgnoreBackendStatus: () => false,
    }),
}));

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        updateSwapStatus: vi.fn().mockResolvedValue(undefined),
        getSwap: vi.fn().mockResolvedValue(null),
        getSwaps: vi.fn().mockResolvedValue([]),
    }),
}));

vi.mock("../../src/utils/notifyParent", () => ({
    useParentNotifier: () => ({ notifyParent: vi.fn() }),
}));

type CloseEvent = { wasClean: boolean; code?: number; reason?: string };

class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    static instances: FakeWebSocket[] = [];

    readonly url: string;
    readyState: number = FakeWebSocket.CONNECTING;

    onopen: (() => void) | null = null;
    onerror: ((ev?: unknown) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onmessage: ((ev: { data: string }) => void | Promise<void>) | null = null;

    send = vi.fn();
    // Does not fire onclose; tests drive close events via triggerClose()
    close = vi.fn(() => {
        this.readyState = FakeWebSocket.CLOSING;
    });

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    message(data: unknown) {
        return this.onmessage?.({ data: JSON.stringify(data) });
    }

    triggerClose(wasClean = false) {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ wasClean, code: wasClean ? 1000 : 1006, reason: "" });
    }

    get pingCount() {
        return this.send.mock.calls.filter(
            (call) => call[0] === JSON.stringify({ op: "ping" }),
        ).length;
    }

    get subscriptions(): Record<string, unknown>[] {
        return this.send.mock.calls
            .map(
                (call) =>
                    JSON.parse(call[0] as string) as Record<string, unknown>,
            )
            .filter((msg) => msg.op === "subscribe");
    }
}

const connectWs = (ids: string[] = []) => {
    const prepareSwap = vi.fn();
    const claimSwap = vi.fn().mockResolvedValue(undefined);
    const ws = new BoltzWebSocket(
        "http://api.test",
        new Set(ids),
        prepareSwap,
        claimSwap,
    );
    ws.connect();
    const socket = FakeWebSocket.instances[0];
    return { ws, socket, prepareSwap, claimSwap };
};

describe("BoltzWebSocket heartbeat", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
        vi.stubGlobal("WebSocket", FakeWebSocket);
        Object.defineProperty(window.navigator, "locks", {
            configurable: true,
            value: {
                request: vi.fn(
                    async (_name: string, callback: () => Promise<unknown>) =>
                        await callback(),
                ),
            },
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test("sends an application ping on the first interval after the socket opens", async () => {
        const { socket } = connectWs();
        socket.open();

        expect(socket.pingCount).toBe(0);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(socket.pingCount).toBe(1);
    });

    test("recreates the socket when no traffic answers the ping before the next interval", async () => {
        const { socket } = connectWs();
        socket.open();

        await vi.advanceTimersByTimeAsync(15_000);
        expect(socket.pingCount).toBe(1);
        expect(FakeWebSocket.instances).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(15_000);
        expect(socket.close).toHaveBeenCalled();
        expect(FakeWebSocket.instances).toHaveLength(2);
    });

    test("does not recreate when a pong arrives within the interval", async () => {
        const { socket } = connectWs();
        socket.open();

        await vi.advanceTimersByTimeAsync(15_000);
        await socket.message({ event: "pong" });
        await vi.advanceTimersByTimeAsync(15_000);

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(socket.pingCount).toBe(2);
    });

    test("treats any inbound message as liveness, not only pongs", async () => {
        const { socket, prepareSwap } = connectWs();
        socket.open();

        await vi.advanceTimersByTimeAsync(15_000);
        await socket.message({
            event: "update",
            channel: "swap.update",
            args: [{ id: "swap-a", status: "transaction.mempool" }],
        });
        expect(prepareSwap).toHaveBeenCalledWith(
            "swap-a",
            expect.objectContaining({ id: "swap-a" }),
        );

        await vi.advanceTimersByTimeAsync(15_000);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    test("stops pinging after close()", async () => {
        const { ws, socket } = connectWs();
        socket.open();

        ws.close();
        await vi.advanceTimersByTimeAsync(60_000);

        expect(socket.pingCount).toBe(0);
        expect(socket.close).toHaveBeenCalled();
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    test("does not schedule a reconnect from the superseded socket after a recreate", async () => {
        const { socket } = connectWs();
        socket.open();

        await vi.advanceTimersByTimeAsync(30_000);
        expect(FakeWebSocket.instances).toHaveLength(2);

        socket.triggerClose(false);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(FakeWebSocket.instances).toHaveLength(2);
    });

    test("runs exactly one heartbeat on the recreated socket", async () => {
        const { socket } = connectWs();
        socket.open();

        await vi.advanceTimersByTimeAsync(30_000);
        expect(FakeWebSocket.instances).toHaveLength(2);

        const recreated = FakeWebSocket.instances[1];
        recreated.open();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(recreated.pingCount).toBe(1);
    });

    test("does not ping or recreate while the socket is not OPEN", async () => {
        const { socket } = connectWs();
        socket.open();

        await vi.advanceTimersByTimeAsync(15_000);
        socket.readyState = FakeWebSocket.CLOSING;
        await vi.advanceTimersByTimeAsync(15_000);

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(socket.pingCount).toBe(1);
    });

    test("re-subscribes the relevant swap ids on the recreated socket", async () => {
        const { socket } = connectWs(["swap-x"]);
        socket.open();
        expect(socket.subscriptions).toContainEqual(
            expect.objectContaining({
                op: "subscribe",
                channel: "swap.update",
                args: ["swap-x"],
            }),
        );

        await vi.advanceTimersByTimeAsync(30_000);
        const recreated = FakeWebSocket.instances[1];
        recreated.open();
        expect(recreated.subscriptions).toContainEqual(
            expect.objectContaining({
                op: "subscribe",
                channel: "swap.update",
                args: ["swap-x"],
            }),
        );
    });

    test("tears down the heartbeat when the SwapChecker unmounts", async () => {
        render(() => <SwapChecker />);
        await vi.advanceTimersByTimeAsync(0);
        expect(FakeWebSocket.instances).toHaveLength(1);

        const socket = FakeWebSocket.instances[0];
        socket.open();

        cleanup();
        await vi.advanceTimersByTimeAsync(60_000);

        expect(socket.pingCount).toBe(0);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });
});
