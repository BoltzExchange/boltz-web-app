import { getLogger } from "../logger.ts";
import type { KeyValueStore } from "./types.ts";

export type LocalStorageKeyValueStoreOptions = {
    // The Web Storage instance to use. Defaults to `globalThis.localStorage`,
    // resolved lazily on first use so this module imports cleanly under Node
    // (e.g. the `check:package` smoke test). Inject a `Storage` in tests.
    storage?: Storage;
    // Namespaces every key so multiple stores can share one `Storage` without
    // colliding. Transparent to callers: `get`/`set`/`remove`/`entries` all
    // operate on the logical (unprefixed) key.
    prefix?: string;
};

// Browser `localStorage`-backed `KeyValueStore`. Values are JSON-serialized, so
// only JSON-safe values may be stored. `localStorage` is synchronous; the async
// interface is honored by resolving immediately.
export class LocalStorageKeyValueStore implements KeyValueStore {
    private readonly injected?: Storage;
    private readonly prefix: string;

    public constructor(options: LocalStorageKeyValueStoreOptions = {}) {
        this.injected = options.storage;
        this.prefix = options.prefix ?? "";
    }

    private resolveStorage(): Storage {
        const storage = this.injected ?? globalThis.localStorage;
        if (storage === undefined || storage === null) {
            throw new Error(
                "LocalStorageKeyValueStore: no Storage available — pass `storage` or run in a browser",
            );
        }
        return storage;
    }

    // Parse a stored value, tolerating corruption: a single unparseable entry
    // (a partial write, or a value written by other code sharing the Storage)
    // must not throw and abort a whole `get`/`entries` — the watcher relies on
    // `entries` to enumerate resumable deposits.
    private parse<T>(physicalKey: string, raw: string): T | undefined {
        try {
            return JSON.parse(raw) as T;
        } catch (error) {
            getLogger().warn(
                "LocalStorageKeyValueStore: skipping corrupt value",
                { key: physicalKey, error },
            );
            return undefined;
        }
    }

    public get = <T>(key: string): Promise<T | undefined> => {
        const physical = this.prefix + key;
        const raw = this.resolveStorage().getItem(physical);
        return Promise.resolve(
            raw === null ? undefined : this.parse<T>(physical, raw),
        );
    };

    public set = <T>(key: string, value: T): Promise<void> => {
        // `undefined` is the absent sentinel and is not JSON-round-trippable
        // (`JSON.stringify(undefined)` is `undefined`, which `setItem` coerces
        // to the string "undefined" and later poisons the key). Treat it as a
        // removal so both stores agree that "set undefined" ≡ "absent".
        if (value === undefined) {
            return this.remove(key);
        }
        this.resolveStorage().setItem(this.prefix + key, JSON.stringify(value));
        return Promise.resolve();
    };

    public remove = (key: string): Promise<void> => {
        this.resolveStorage().removeItem(this.prefix + key);
        return Promise.resolve();
    };

    public entries = <T>(prefix?: string): Promise<Array<[string, T]>> => {
        const storage = this.resolveStorage();
        const result: Array<[string, T]> = [];
        for (let i = 0; i < storage.length; i++) {
            const physical = storage.key(i);
            if (physical === null || !physical.startsWith(this.prefix)) {
                continue;
            }
            const logical = physical.slice(this.prefix.length);
            if (prefix !== undefined && !logical.startsWith(prefix)) {
                continue;
            }
            const raw = storage.getItem(physical);
            if (raw === null) {
                continue;
            }
            const value = this.parse<T>(physical, raw);
            if (value !== undefined) {
                result.push([logical, value]);
            }
        }
        return Promise.resolve(result);
    };
}
