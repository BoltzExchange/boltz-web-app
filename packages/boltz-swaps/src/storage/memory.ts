import { LocalStorageKeyValueStore } from "./localStorage.ts";
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

// Coerces like real Web Storage so the shared engine behaves identically.
// Also serves as the injectable `Storage` double in tests.
export const createMapStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (key: string) => map.get(String(key)) ?? null,
        key: (index: number) => [...map.keys()][index] ?? null,
        removeItem: (key: string) => {
            map.delete(String(key));
        },
        setItem: (key: string, value: string) => {
            map.set(String(key), String(value));
        },
    } as Storage;
};

// In-memory `KeyValueStore` that delegates to `LocalStorageKeyValueStore` over
// a Map-backed `Storage`, so the two stores share one JSON engine and cannot
// diverge (a value that fails to round-trip durably fails here too). State is
// lost on restart — see the required acknowledgment.
export class MemoryKeyValueStore implements KeyValueStore {
    private readonly inner: LocalStorageKeyValueStore;

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
        this.inner = new LocalStorageKeyValueStore({
            storage: createMapStorage(),
        });
    }

    public get = <T>(key: string): Promise<T | undefined> =>
        this.inner.get<T>(key);

    public set = <T>(key: string, value: T): Promise<void> =>
        this.inner.set(key, value);

    public remove = (key: string): Promise<void> => this.inner.remove(key);

    public entries = <T>(prefix?: string): Promise<Array<[string, T]>> =>
        this.inner.entries<T>(prefix);
}
