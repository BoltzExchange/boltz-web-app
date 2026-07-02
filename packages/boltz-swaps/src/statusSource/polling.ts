import { getSwapStatus, getSwapStatuses } from "../client.ts";
import { safeEmit, safeEmitError } from "./emit.ts";
import type {
    StatusErrorHandler,
    StatusSource,
    StatusUpdateHandler,
    SwapUpdate,
    Unsubscribe,
} from "./types.ts";

export type PollingStatusSourceOptions = {
    // Delay between fetches in ms. Default 5000.
    intervalMs?: number;
};

type PollingEntry = {
    handlers: Set<StatusUpdateHandler>;
    errorHandlers: Set<StatusErrorHandler>;
    lastUpdate?: SwapUpdate;
    lastSignature?: string;
};

// REST polling StatusSource: one shared loop bulk-fetches all tracked ids per
// interval (GET /v2/swap/status) and fans each out to its subscribers, emitting
// only when an id's status changes.
export const createPollingStatusSource = (
    options: PollingStatusSourceOptions = {},
): StatusSource => {
    const intervalMs = options.intervalMs ?? 5_000;
    const entries = new Map<string, PollingEntry>();

    let intervalTimer: ReturnType<typeof setTimeout> | undefined;
    let immediateTimer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    let repollRequested = false;
    let closed = false;

    const deliver = (id: string, update: SwapUpdate): void => {
        const entry = entries.get(id);
        if (entry === undefined) {
            return;
        }
        entry.lastUpdate = update;
        const signature = JSON.stringify(update);
        if (entry.lastSignature === signature) {
            // Unchanged since the last delivery: skip, matching the WebSocket
            // source, which only emits when the backend pushes a change.
            return;
        }
        entry.lastSignature = signature;
        for (const handler of entry.handlers) {
            safeEmit(handler, update);
        }
    };

    const deliverError = (id: string, error: unknown): void => {
        const entry = entries.get(id);
        if (entry === undefined) {
            return;
        }
        safeEmitError(entry.errorHandlers, error, id);
    };

    const pollIndividually = async (ids: string[]): Promise<void> => {
        await Promise.all(
            ids.map(async (id) => {
                try {
                    const status = await getSwapStatus(id);
                    deliver(id, { id, ...status });
                } catch (error) {
                    deliverError(id, error);
                }
            }),
        );
    };

    const pollAll = async (ids: string[]): Promise<void> => {
        try {
            const result = await getSwapStatuses(ids);
            for (const id of ids) {
                const status = result[id];
                if (status !== undefined) {
                    deliver(id, { id, ...status });
                }
            }
        } catch {
            // Bulk is all-or-nothing (one unknown id 400s the batch); fall back
            // to per-id fetches so bad ids surface their own error individually.
            await pollIndividually(ids);
        }
    };

    const scheduleInterval = (): void => {
        if (entries.size === 0 || intervalTimer !== undefined) {
            return;
        }
        intervalTimer = setTimeout(() => {
            intervalTimer = undefined;
            void tick();
        }, intervalMs);
    };

    const scheduleImmediate = (): void => {
        if (polling) {
            repollRequested = true;
            return;
        }
        if (immediateTimer !== undefined) {
            return;
        }
        immediateTimer = setTimeout(() => {
            immediateTimer = undefined;
            void tick();
        }, 0);
    };

    const tick = async (): Promise<void> => {
        if (polling) {
            return;
        }
        if (intervalTimer !== undefined) {
            clearTimeout(intervalTimer);
            intervalTimer = undefined;
        }
        const ids = [...entries.keys()];
        if (ids.length === 0) {
            return;
        }
        polling = true;
        repollRequested = false;
        try {
            await pollAll(ids);
        } finally {
            polling = false;
            if (entries.size > 0) {
                if (repollRequested) {
                    repollRequested = false;
                    scheduleImmediate();
                } else {
                    scheduleInterval();
                }
            }
        }
    };

    return {
        subscribe(id, onUpdate, onError): Unsubscribe {
            if (closed) {
                return () => {};
            }
            let entry = entries.get(id);
            const isNew = entry === undefined;
            if (entry === undefined) {
                entry = { handlers: new Set(), errorHandlers: new Set() };
                entries.set(id, entry);
            }
            const handlerIsNew = !entry.handlers.has(onUpdate);
            if (handlerIsNew) {
                entry.handlers.add(onUpdate);
            }
            if (onError !== undefined) {
                entry.errorHandlers.add(onError);
            }
            // Late joiner: hand over the current status immediately (skipped for
            // an idempotent re-subscribe of a handler already registered).
            if (!isNew && handlerIsNew && entry.lastUpdate !== undefined) {
                safeEmit(onUpdate, entry.lastUpdate);
            }
            // New id: poll promptly, not after a full interval (coalesced).
            if (isNew) {
                scheduleImmediate();
            }

            return () => {
                const current = entries.get(id);
                if (current === undefined) {
                    return;
                }
                current.handlers.delete(onUpdate);
                if (onError !== undefined) {
                    current.errorHandlers.delete(onError);
                }
                if (current.handlers.size === 0) {
                    entries.delete(id);
                    if (entries.size === 0) {
                        if (intervalTimer !== undefined) {
                            clearTimeout(intervalTimer);
                            intervalTimer = undefined;
                        }
                        if (immediateTimer !== undefined) {
                            clearTimeout(immediateTimer);
                            immediateTimer = undefined;
                        }
                    }
                }
            };
        },
        close(): void {
            closed = true;
            if (intervalTimer !== undefined) {
                clearTimeout(intervalTimer);
                intervalTimer = undefined;
            }
            if (immediateTimer !== undefined) {
                clearTimeout(immediateTimer);
                immediateTimer = undefined;
            }
            entries.clear();
        },
    };
};
