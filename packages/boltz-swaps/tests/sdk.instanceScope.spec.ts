import { createBoltzClient, setBoltzSwapsConfig } from "boltz-swaps";
import { afterEach, describe, expect, test, vi } from "vitest";

const urls = {
    first: "https://first.example",
    second: "https://second.example",
    third: "https://third.example",
};

const jsonResponse = (body: unknown): Response =>
    ({
        ok: true,
        json: async () => body,
    }) as Response;

class FakeWebSocket {
    static instances: FakeWebSocket[] = [];

    readonly readyState = 0;
    onopen: ((event: unknown) => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: ((event: { wasClean?: boolean }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    send(_data: string): void {}

    close(): void {}
}

afterEach(() => {
    setBoltzSwapsConfig({});
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeWebSocket.instances = [];
});

describe("createBoltzClient instance scoping", () => {
    test("injected swap.subscribe uses the status source captured by its client", () => {
        const firstSource = { subscribe: vi.fn(() => () => {}) };
        const secondSource = { subscribe: vi.fn(() => () => {}) };
        const thirdSource = { subscribe: vi.fn(() => () => {}) };

        const first = createBoltzClient({
            boltzApiUrl: urls.first,
            statusSource: firstSource,
        });
        const second = createBoltzClient({
            boltzApiUrl: urls.second,
            statusSource: secondSource,
        });
        const third = createBoltzClient({
            boltzApiUrl: urls.third,
            statusSource: thirdSource,
        });

        first.swap.subscribe("a", () => {});
        second.swap.subscribe("b", () => {});
        third.swap.subscribe("c", () => {});

        expect(firstSource.subscribe).toHaveBeenCalledTimes(1);
        expect(firstSource.subscribe).toHaveBeenCalledWith(
            "a",
            expect.any(Function),
            undefined,
        );
        expect(secondSource.subscribe).toHaveBeenCalledTimes(1);
        expect(secondSource.subscribe).toHaveBeenCalledWith(
            "b",
            expect.any(Function),
            undefined,
        );
        expect(thirdSource.subscribe).toHaveBeenCalledTimes(1);
        expect(thirdSource.subscribe).toHaveBeenCalledWith(
            "c",
            expect.any(Function),
            undefined,
        );
    });

    test("swap.status uses the API URL captured by its client", async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse({ status: "swap.created" }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const first = createBoltzClient({ boltzApiUrl: urls.first });
        const second = createBoltzClient({ boltzApiUrl: urls.second });
        const third = createBoltzClient({ boltzApiUrl: urls.third });

        await first.swap.status("a");
        await second.swap.status("b");
        await third.swap.status("c");

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            `${urls.first}/v2/swap/a`,
            expect.any(Object),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `${urls.second}/v2/swap/b`,
            expect.any(Object),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            `${urls.third}/v2/swap/c`,
            expect.any(Object),
        );
    });

    test("swap.statuses uses the API URL captured by its client", async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse({ a: { status: "swap.created" } }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const first = createBoltzClient({ boltzApiUrl: urls.first });
        const second = createBoltzClient({ boltzApiUrl: urls.second });
        const third = createBoltzClient({ boltzApiUrl: urls.third });

        await first.swap.statuses(["a"]);
        await second.swap.statuses(["b"]);
        await third.swap.statuses(["c"]);

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            `${urls.first}/v2/swap/status?ids=a`,
            expect.any(Object),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `${urls.second}/v2/swap/status?ids=b`,
            expect.any(Object),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            `${urls.third}/v2/swap/status?ids=c`,
            expect.any(Object),
        );
    });

    test("default swap.subscribe uses the API URL captured by its client", () => {
        vi.stubGlobal("WebSocket", FakeWebSocket);

        const first = createBoltzClient({ boltzApiUrl: urls.first });
        const second = createBoltzClient({ boltzApiUrl: urls.second });
        const third = createBoltzClient({ boltzApiUrl: urls.third });

        const unsubscribe = [
            first.swap.subscribe("a", () => {}),
            second.swap.subscribe("b", () => {}),
            third.swap.subscribe("c", () => {}),
        ];

        try {
            expect(FakeWebSocket.instances.map(({ url }) => url)).toEqual([
                "wss://first.example/v2/ws",
                "wss://second.example/v2/ws",
                "wss://third.example/v2/ws",
            ]);
        } finally {
            for (const stop of unsubscribe) {
                stop();
            }
        }
    });
});
