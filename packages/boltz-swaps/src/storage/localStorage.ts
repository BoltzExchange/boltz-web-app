/* eslint-disable require-await, @typescript-eslint/require-await --
   the methods are async so sync failures (e.g. QuotaExceededError from
   setItem) reject instead of throwing past callers' .catch handlers */
import { getLogger } from "../logger.ts";
import type { KeyValueStore } from "./types.ts";

export type LocalStorageKeyValueStoreOptions = {
    // The Web Storage instance to use. Defaults to `globalThis.localStorage`;
    // the constructor throws when neither is available. Inject a `Storage` in
    // tests.
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
    private readonly storage: Storage;
    private readonly namespace: string;

    public constructor(options: LocalStorageKeyValueStoreOptions = {}) {
        const storage = options.storage ?? globalThis.localStorage;
        if (storage === undefined || storage === null) {
            throw new Error(
                "LocalStorageKeyValueStore: no Storage available — pass `storage` or run in a browser",
            );
        }
        this.storage = storage;
        const prefix = options.prefix ?? "";
        // Encoding the prefix length makes the namespace/key boundary
        // unambiguous. For example, ("a", "bc") and ("ab", "c") become
        // "1:abc" and "2:abc" instead of both mapping to "abc".
        this.namespace = `${prefix.length}:${prefix}`;
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

    public get = async <T>(key: string): Promise<T | undefined> => {
        const physical = this.namespace + key;
        const raw = this.storage.getItem(physical);
        return raw === null ? undefined : this.parse<T>(physical, raw);
    };

    public set = async <T>(key: string, value: T): Promise<void> => {
        // `undefined` is the absent sentinel and is not JSON-round-trippable
        // (`JSON.stringify(undefined)` is `undefined`, which `setItem` coerces
        // to the string "undefined" and later poisons the key). Treat it as a
        // removal so both stores agree that "set undefined" ≡ "absent".
        if (value === undefined) {
            return this.remove(key);
        }
        this.storage.setItem(this.namespace + key, JSON.stringify(value));
    };

    public remove = async (key: string): Promise<void> => {
        this.storage.removeItem(this.namespace + key);
    };

    public entries = async <T>(
        prefix?: string,
    ): Promise<Array<[string, T]>> => {
        const result: Array<[string, T]> = [];
        for (let i = 0; i < this.storage.length; i++) {
            const physical = this.storage.key(i);
            if (physical === null || !physical.startsWith(this.namespace)) {
                continue;
            }
            const logical = physical.slice(this.namespace.length);
            if (prefix !== undefined && !logical.startsWith(prefix)) {
                continue;
            }
            const raw = this.storage.getItem(physical);
            if (raw === null) {
                continue;
            }
            const value = this.parse<T>(physical, raw);
            if (value !== undefined) {
                result.push([logical, value]);
            }
        }
        return result;
    };
}
