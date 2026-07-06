import type { KeyValueStore } from "./types.ts";

export type MemoryKeyValueStoreOptions = {
    // Required, self-documenting acknowledgment that this store is in-memory and
    // its data is lost on every restart. There is no safe production use for a
    // resumable workflow: e.g. as the deposit-watcher store it cannot recover
    // in-flight deposits after a restart, which can strand bridged/locked funds.
    // Set `true` only for tests / intentional ephemeral use; otherwise use a
    // durable `KeyValueStore` (e.g. `LocalStorageKeyValueStore`).
    inMemoryStorageShouldNeverBeUsedInProduction: boolean;
};

// In-memory `KeyValueStore`, backed by a `Map`. Structured-clones on read and
// write so callers cannot mutate stored values by reference. Note this does NOT
// enforce JSON-safety (structuredClone happily clones bigint/Map/Date), so a
// value that round-trips here may still fail under a JSON-backed store like
// `LocalStorageKeyValueStore` — keep stored values JSON-serializable. Suitable
// for tests, examples, and single-process ephemeral use; state is lost on
// restart — see the required `inMemoryStorageShouldNeverBeUsedInProduction`
// acknowledgment.
export class MemoryKeyValueStore implements KeyValueStore {
    private readonly store = new Map<string, unknown>();

    public constructor(options: MemoryKeyValueStoreOptions) {
        // Optional chaining defends against JS callers (no types) omitting the
        // argument entirely — they get this message, not a raw TypeError.
        if (options?.inMemoryStorageShouldNeverBeUsedInProduction !== true) {
            throw new Error(
                "MemoryKeyValueStore is in-memory and its data is lost on every restart. " +
                    "As a resumable-workflow store (e.g. the deposit watcher) this can strand " +
                    "funds — in-flight deposits cannot be recovered after a restart. Pass " +
                    "{ inMemoryStorageShouldNeverBeUsedInProduction: true } to acknowledge " +
                    "intentional ephemeral/test use, or use a durable KeyValueStore such as " +
                    "LocalStorageKeyValueStore.",
            );
        }
    }

    public get = <T>(key: string): Promise<T | undefined> => {
        const value = this.store.get(key);
        return Promise.resolve(
            value === undefined ? undefined : (structuredClone(value) as T),
        );
    };

    public set = <T>(key: string, value: T): Promise<void> => {
        // `undefined` is the absent sentinel; storing it would make `entries`
        // yield a phantom `[key, undefined]` pair. Treat it as a removal, matching
        // `LocalStorageKeyValueStore`.
        if (value === undefined) {
            return this.remove(key);
        }
        this.store.set(key, structuredClone(value));
        return Promise.resolve();
    };

    public remove = (key: string): Promise<void> => {
        this.store.delete(key);
        return Promise.resolve();
    };

    public entries = <T>(prefix?: string): Promise<Array<[string, T]>> =>
        Promise.resolve(
            [...this.store.entries()]
                .filter(
                    ([key]) => prefix === undefined || key.startsWith(prefix),
                )
                .map(
                    ([key, value]) =>
                        [key, structuredClone(value) as T] as [string, T],
                ),
        );
}
