// A generic async key-value store, reusable across the SDK (e.g. the deposit
// watcher persists through it). All methods are async so an implementation can
// be backed by localStorage, IndexedDB, a file, or a remote DB. Values must be
// JSON-serializable so persistent backends can round-trip them.
export interface KeyValueStore {
    // Resolves to the stored value, or `undefined` when the key is absent. A
    // stored falsy value (e.g. `0`) round-trips as itself, never as `undefined`.
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    // All `[key, value]` pairs, optionally restricted to keys starting with
    // `prefix` — the enumeration primitive for collection-style reads.
    entries<T>(prefix?: string): Promise<Array<[key: string, value: T]>>;
}
