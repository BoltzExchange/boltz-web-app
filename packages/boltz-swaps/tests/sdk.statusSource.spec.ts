import { createBoltzClient } from "boltz-swaps";
import { vi } from "vitest";

import type { StatusSource, SwapUpdate } from "../src/statusSource/index.ts";

const mocks = vi.hoisted(() => ({
    getSwapStatuses: vi.fn(),
    createDefaultStatusSource: vi.fn(),
}));

vi.mock("../src/client.ts", async (importActual) => ({
    ...(await importActual<typeof import("../src/client.ts")>()),
    getSwapStatuses: mocks.getSwapStatuses,
}));

vi.mock("../src/statusSource/index.ts", async (importActual) => ({
    ...(await importActual<typeof import("../src/statusSource/index.ts")>()),
    createDefaultStatusSource: mocks.createDefaultStatusSource,
}));

const flush = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    mocks.getSwapStatuses.mockReset();
    mocks.createDefaultStatusSource
        .mockReset()
        .mockReturnValue({ subscribe: () => () => {} } as StatusSource);
});

const makeClient = (statusSource?: StatusSource) =>
    createBoltzClient({
        boltzApiUrl: "https://test.boltz.exchange",
        ...(statusSource ? { statusSource } : {}),
    });

describe("createBoltzClient: swap.statuses", () => {
    test("delegates to getSwapStatuses and returns its result", async () => {
        mocks.getSwapStatuses.mockResolvedValue({
            id1: { status: "swap.created" },
        });

        const result = await makeClient().swap.statuses(["id1", "id2"]);

        expect(mocks.getSwapStatuses).toHaveBeenCalledWith(["id1", "id2"]);
        expect(result).toEqual({ id1: { status: "swap.created" } });
    });
});

describe("createBoltzClient: swap.subscribe / swap.watch", () => {
    test("subscribe forwards to the injected status source and returns its unsubscribe", () => {
        const unsubscribe = vi.fn();
        const subscribe = vi.fn(() => unsubscribe);
        const onUpdate = vi.fn();
        const onError = vi.fn();

        const client = makeClient({ subscribe });
        const off = client.swap.subscribe("id1", onUpdate, onError);

        expect(subscribe).toHaveBeenCalledWith("id1", onUpdate, onError);
        expect(mocks.createDefaultStatusSource).not.toHaveBeenCalled();

        off();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test("watch yields updates streamed from the injected status source", async () => {
        let handler: ((update: SwapUpdate) => void) | undefined;
        const subscribe = vi.fn((_id, onUpdate) => {
            handler = onUpdate;
            return () => {};
        });

        const client = makeClient({ subscribe });
        const updates: SwapUpdate[] = [];
        const controller = new AbortController();
        const run = (async () => {
            for await (const update of client.swap.watch("id1", {
                signal: controller.signal,
            })) {
                updates.push(update);
                controller.abort();
            }
        })();

        await flush();
        handler?.({ id: "id1", status: "swap.created" });
        await run;

        expect(subscribe).toHaveBeenCalledWith(
            "id1",
            expect.any(Function),
            expect.any(Function),
        );
        expect(updates).toEqual([{ id: "id1", status: "swap.created" }]);
    });

    test("creates the default status source lazily, once per client, and reuses it", () => {
        const subscribe = vi.fn(() => () => {});
        mocks.createDefaultStatusSource.mockReturnValue({ subscribe });

        const client = makeClient();
        // Not created until the first subscribe/watch call.
        expect(mocks.createDefaultStatusSource).not.toHaveBeenCalled();

        client.swap.subscribe("a", () => {});
        client.swap.subscribe("b", () => {});

        // One source per client, reused across calls.
        expect(mocks.createDefaultStatusSource).toHaveBeenCalledTimes(1);
        expect(subscribe).toHaveBeenCalledTimes(2);
    });

    test("each client gets its own default status source", () => {
        const sources = [
            { subscribe: vi.fn(() => () => {}) },
            { subscribe: vi.fn(() => () => {}) },
        ];
        mocks.createDefaultStatusSource
            .mockReturnValueOnce(sources[0])
            .mockReturnValueOnce(sources[1]);

        const first = makeClient();
        const second = makeClient();
        first.swap.subscribe("a", () => {});
        second.swap.subscribe("b", () => {});

        expect(mocks.createDefaultStatusSource).toHaveBeenCalledTimes(2);
        expect(sources[0].subscribe).toHaveBeenCalledTimes(1);
        expect(sources[1].subscribe).toHaveBeenCalledTimes(1);
    });
});
