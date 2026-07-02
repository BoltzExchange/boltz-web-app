import { isFinalStatus } from "../status.ts";
import type { StatusSource, SwapUpdate, Unsubscribe } from "./types.ts";

export type WatchOptions = {
    // Abort the iteration (and unsubscribe) when this signal fires.
    signal?: AbortSignal;
    // Surface source errors as an iterator throw. Default false: keep streaming.
    throwOnError?: boolean;
    // Stop and unsubscribe once a terminal status arrives. Default true.
    stopOnFinal?: boolean;
};

export async function* watchStatus(
    source: StatusSource,
    id: string,
    options: WatchOptions = {},
): AsyncGenerator<SwapUpdate> {
    if (options.signal?.aborted === true) {
        return;
    }
    const stopOnFinal = options.stopOnFinal ?? true;

    const queue: SwapUpdate[] = [];
    let wake: (() => void) | undefined;
    let failure: unknown;
    let failed = false;
    let done = false;

    const notify = (): void => {
        const resume = wake;
        wake = undefined;
        resume?.();
    };

    let torndown = false;
    let pendingTeardown = false;
    // eslint-disable-next-line prefer-const -- read by teardown, may fire during subscribe()
    let unsubscribe: Unsubscribe | undefined;
    const teardown = (): void => {
        if (torndown) {
            return;
        }
        if (unsubscribe === undefined) {
            pendingTeardown = true;
            return;
        }
        torndown = true;
        unsubscribe();
    };

    unsubscribe = source.subscribe(
        id,
        (update) => {
            queue.push(update);
            if (stopOnFinal && isFinalStatus(update.status)) {
                done = true;
                teardown();
            }
            notify();
        },
        (error) => {
            if (options.throwOnError === true) {
                failure = error;
                failed = true;
                teardown();
                notify();
            }
        },
    );
    if (pendingTeardown) {
        teardown();
    }

    const onAbort = (): void => {
        done = true;
        teardown();
        notify();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
        for (;;) {
            while (queue.length === 0 && !done && !failed) {
                await new Promise<void>((resolve) => {
                    wake = resolve;
                });
            }
            while (queue.length > 0) {
                yield queue.shift() as SwapUpdate;
            }
            if (failed) {
                throw failure;
            }
            if (done) {
                return;
            }
        }
    } finally {
        teardown();
        options.signal?.removeEventListener("abort", onAbort);
    }
}
