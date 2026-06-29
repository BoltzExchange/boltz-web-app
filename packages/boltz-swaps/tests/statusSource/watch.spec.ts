import { vi } from "vitest";

import {
    type StatusErrorHandler,
    type StatusSource,
    type StatusUpdateHandler,
    type SwapUpdate,
    watchStatus,
} from "../../src/statusSource/index.ts";

const flush = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 0));

describe("watchStatus", () => {
    test("is a no-op when the signal is already aborted (never subscribes)", async () => {
        const controller = new AbortController();
        controller.abort();
        const subscribe = vi.fn(() => () => {});
        const source: StatusSource = { subscribe };

        const iterator = watchStatus(source, "a", {
            signal: controller.signal,
        });
        const first = await iterator.next();

        expect(first.done).toBe(true);
        expect(subscribe).not.toHaveBeenCalled();
    });

    test("does not register an abort listener when subscribe throws", async () => {
        const signal = new AbortController().signal;
        const addSpy = vi.spyOn(signal, "addEventListener");
        const source: StatusSource = {
            subscribe: () => {
                throw new Error("no ws");
            },
        };

        const iterator = watchStatus(source, "a", { signal });
        await expect(iterator.next()).rejects.toThrow("no ws");
        expect(addSpy).not.toHaveBeenCalled();
    });

    test("drains queued updates before surfacing an error", async () => {
        let onUpdate: StatusUpdateHandler | undefined;
        let onError: StatusErrorHandler | undefined;
        const source: StatusSource = {
            subscribe: (_id, update, error) => {
                onUpdate = update;
                onError = error;
                return () => {};
            },
        };

        const iterator = watchStatus(source, "a", { throwOnError: true });
        const firstPending = iterator.next();
        await flush();

        onUpdate?.({ id: "a", status: "swap.created" });
        onError?.(new Error("boom"), "a");

        const first = await firstPending;
        expect(first.done).toBe(false);
        expect((first.value as SwapUpdate).status).toBe("swap.created");
        await expect(iterator.next()).rejects.toThrow("boom");
    });

    test("yields updates and unsubscribes when aborted", async () => {
        const controller = new AbortController();
        let onUpdate: StatusUpdateHandler | undefined;
        let unsubscribed = false;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                onUpdate = update;
                return () => {
                    unsubscribed = true;
                };
            },
        };

        const seen: SwapUpdate[] = [];
        const run = (async () => {
            for await (const update of watchStatus(source, "a", {
                signal: controller.signal,
            })) {
                seen.push(update);
            }
        })();

        await flush();
        onUpdate?.({ id: "a", status: "swap.created" });
        await flush();
        controller.abort();
        await run;

        expect(seen.map((u) => u.status)).toEqual(["swap.created"]);
        expect(unsubscribed).toBe(true);
    });

    test("swallows source errors by default and keeps streaming", async () => {
        let onUpdate: StatusUpdateHandler | undefined;
        let onError: StatusErrorHandler | undefined;
        const source: StatusSource = {
            subscribe: (_id, update, error) => {
                onUpdate = update;
                onError = error;
                return () => {};
            },
        };

        const iterator = watchStatus(source, "a"); // throwOnError defaults false
        const firstPending = iterator.next();
        await flush();

        onError?.(new Error("boom"), "a"); // must not surface
        onUpdate?.({ id: "a", status: "swap.created" });

        const first = await firstPending;
        expect(first.done).toBe(false);
        expect((first.value as SwapUpdate).status).toBe("swap.created");
    });

    test("unsubscribes when the consumer breaks out of the loop", async () => {
        let onUpdate: StatusUpdateHandler | undefined;
        let unsubscribed = false;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                onUpdate = update;
                return () => {
                    unsubscribed = true;
                };
            },
        };

        const seen: SwapUpdate[] = [];
        const run = (async () => {
            for await (const update of watchStatus(source, "a")) {
                seen.push(update);
                break;
            }
        })();

        await flush();
        onUpdate?.({ id: "a", status: "swap.created" });
        await run;

        expect(seen.map((u) => u.status)).toEqual(["swap.created"]);
        expect(unsubscribed).toBe(true);
    });

    test("tears down on abort even while parked at a yield (consumer not pulling)", async () => {
        const controller = new AbortController();
        let onUpdate: StatusUpdateHandler | undefined;
        let unsubscribed = false;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                onUpdate = update;
                return () => {
                    unsubscribed = true;
                };
            },
        };

        const iterator = watchStatus(source, "a", {
            signal: controller.signal,
        });
        const pending = iterator.next();
        await flush();
        onUpdate?.({ id: "a", status: "swap.created" });
        const first = await pending;
        expect((first.value as SwapUpdate).status).toBe("swap.created");

        expect(unsubscribed).toBe(false);

        controller.abort();
        await flush();
        expect(unsubscribed).toBe(true);

        await iterator.return(undefined);
    });

    test("drains every buffered update in order before an abort stops iteration", async () => {
        const controller = new AbortController();
        let onUpdate: StatusUpdateHandler | undefined;
        let unsubCount = 0;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                onUpdate = update;
                return () => {
                    unsubCount += 1;
                };
            },
        };

        const seen: SwapUpdate[] = [];
        const run = (async () => {
            for await (const update of watchStatus(source, "a", {
                signal: controller.signal,
            })) {
                seen.push(update);
            }
        })();

        await flush();
        onUpdate?.({ id: "a", status: "swap.created" });
        onUpdate?.({ id: "a", status: "transaction.mempool" });
        onUpdate?.({ id: "a", status: "transaction.confirmed" });
        controller.abort();
        await run;

        expect(seen.map((u) => u.status)).toEqual([
            "swap.created",
            "transaction.mempool",
            "transaction.confirmed",
        ]);
        expect(unsubCount).toBe(1);
    });

    test("unsubscribes on a terminal status even if the consumer stops pulling", async () => {
        let onUpdate: StatusUpdateHandler | undefined;
        let unsubscribed = false;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                onUpdate = update;
                return () => {
                    unsubscribed = true;
                };
            },
        };

        const iterator = watchStatus(source, "a");
        const pending = iterator.next();
        await flush();

        onUpdate?.({ id: "a", status: "transaction.claimed" });
        const first = await pending;
        expect((first.value as SwapUpdate).status).toBe("transaction.claimed");

        expect(unsubscribed).toBe(true);

        const second = await iterator.next();
        expect(second.done).toBe(true);
    });

    test("handles a terminal status replayed synchronously during subscribe", async () => {
        let unsubscribed = false;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                update({ id: "a", status: "transaction.claimed" });
                return () => {
                    unsubscribed = true;
                };
            },
        };

        const seen: SwapUpdate[] = [];
        for await (const update of watchStatus(source, "a")) {
            seen.push(update);
        }

        expect(seen.map((u) => u.status)).toEqual(["transaction.claimed"]);
        expect(unsubscribed).toBe(true);
    });

    test("stopOnFinal:false keeps the subscription open past a terminal status", async () => {
        let onUpdate: StatusUpdateHandler | undefined;
        let unsubscribed = false;
        const source: StatusSource = {
            subscribe: (_id, update) => {
                onUpdate = update;
                return () => {
                    unsubscribed = true;
                };
            },
        };

        const iterator = watchStatus(source, "a", { stopOnFinal: false });
        const pending = iterator.next();
        await flush();

        onUpdate?.({ id: "a", status: "transaction.claimed" });
        const first = await pending;
        expect((first.value as SwapUpdate).status).toBe("transaction.claimed");

        expect(unsubscribed).toBe(false);
        const nextPending = iterator.next();
        onUpdate?.({ id: "a", status: "invoice.settled" });
        const second = await nextPending;
        expect((second.value as SwapUpdate).status).toBe("invoice.settled");

        await iterator.return(undefined);
        expect(unsubscribed).toBe(true);
    });
});
