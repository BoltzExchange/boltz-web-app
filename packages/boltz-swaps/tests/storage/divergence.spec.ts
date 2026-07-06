import {
    LocalStorageKeyValueStore,
    MemoryKeyValueStore,
} from "boltz-swaps/storage";
import { describe, expect, it } from "vitest";

import { createFakeStorage } from "./fakeStorage.ts";

// The two stores diverge on JSON-safety: structuredClone (memory) accepts a
// bigint, JSON.stringify (localStorage) rejects it. Pin the contract gap so a
// memory-safe value is known to hard-fail in the durable store.
describe("store JSON-safety divergence", () => {
    it("MemoryKeyValueStore round-trips a bigint", async () => {
        const mem = new MemoryKeyValueStore({
            inMemoryStorageShouldNeverBeUsedInProduction: true,
        });
        await mem.set("b", 5n);
        expect(await mem.get<bigint>("b")).toBe(5n);
    });

    it("LocalStorageKeyValueStore.set throws synchronously on a bigint", () => {
        const ls = new LocalStorageKeyValueStore({
            storage: createFakeStorage(),
        });
        // set is an arrow property that JSON.stringifies before returning the
        // promise, so the TypeError surfaces without awaiting.
        expect(() => ls.set("b", 5n)).toThrow(TypeError);
    });
});
