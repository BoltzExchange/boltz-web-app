import { LocalStorageKeyValueStore } from "boltz-swaps/storage";
import { describe, expect, it, vi } from "vitest";

import { setLogger } from "../../src/logger.ts";
import { createMapStorage } from "../../src/storage/memory.ts";

const physicalKey = (prefix: string, key: string) =>
    `${prefix.length}:${prefix}${key}`;

// The shared behavioral contract lives in parity.spec.ts; here only the
// Storage-specific behavior.
describe("LocalStorageKeyValueStore", () => {
    it("tolerates a corrupt value: get returns undefined and entries skips it", async () => {
        const storage = createMapStorage();
        const kv = new LocalStorageKeyValueStore({ storage, prefix: "boltz." });
        await kv.set("good", { ok: true });
        storage.setItem(physicalKey("boltz.", "bad"), "{not valid json"); // partial write
        expect(await kv.get("bad")).toBeUndefined();
        expect((await kv.entries()).map(([k]) => k)).toEqual(["good"]);
    });

    it("enumerates entries by logical prefix, stripping the store prefix", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createMapStorage(),
            prefix: "boltz.deposit.",
        });
        await kv.set("deposit.1", { id: 1 });
        await kv.set("deposit.2", { id: 2 });
        await kv.set("watermark.POL", 10);
        const deposits = await kv.entries<{ id: number }>("deposit.");
        expect(deposits.map(([k]) => k).sort()).toEqual([
            "deposit.1",
            "deposit.2",
        ]);
    });

    it("combines corrupt-skip and logical-prefix filter in one entries() call", async () => {
        const storage = createMapStorage();
        const kv = new LocalStorageKeyValueStore({ storage, prefix: "boltz." });
        await kv.set("deposit.1", { id: 1 });
        await kv.set("deposit.2", { id: 2 });
        await kv.set("watermark.POL", 10);
        storage.setItem(physicalKey("boltz.", "deposit.bad"), "{not json");
        const e = await kv.entries<{ id: number }>("deposit.");
        expect(e.map(([k]) => k).sort()).toEqual(["deposit.1", "deposit.2"]);
    });

    it("warns with the physical key on a corrupt value", async () => {
        const warn = vi.fn();
        const noop = () => {};
        setLogger({
            trace: noop,
            debug: noop,
            info: noop,
            warn,
            error: noop,
            log: noop,
        });
        try {
            const storage = createMapStorage();
            const kv = new LocalStorageKeyValueStore({
                storage,
                prefix: "boltz.",
            });
            const badKey = physicalKey("boltz.", "bad");
            storage.setItem(badKey, "{nope");
            expect(await kv.get("bad")).toBeUndefined();
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining("corrupt"),
                expect.objectContaining({ key: badKey }),
            );
        } finally {
            setLogger({
                trace: noop,
                debug: noop,
                info: noop,
                warn: noop,
                error: noop,
                log: noop,
            });
        }
    });

    // Exercises the null-key and null-raw defensive skips that
    // createMapStorage cannot produce at an in-range index.
    it("skips null keys and null raw values in entries() without throwing", async () => {
        const goodKey = physicalKey("boltz.", "good");
        const goneKey = physicalKey("boltz.", "gone");
        const keys: Array<string | null> = [null, goodKey, goneKey];
        const double = {
            length: keys.length,
            key: (i: number) => keys[i] ?? null,
            getItem: (k: string) =>
                k === goodKey ? JSON.stringify({ ok: true }) : null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
        } as unknown as Storage;
        const kv = new LocalStorageKeyValueStore({
            storage: double,
            prefix: "boltz.",
        });
        expect(await kv.entries<{ ok: boolean }>()).toEqual([
            ["good", { ok: true }],
        ]);
    });

    it("isolates two stores sharing one Storage via prefix", async () => {
        const shared = createMapStorage();
        const a = new LocalStorageKeyValueStore({
            storage: shared,
            prefix: "a.",
        });
        const b = new LocalStorageKeyValueStore({
            storage: shared,
            prefix: "b.",
        });
        await a.set("k", "from-a");
        await b.set("k", "from-b");
        expect(await a.get("k")).toBe("from-a");
        expect(await b.get("k")).toBe("from-b");
        expect((await a.entries()).length).toBe(1);
    });

    it("isolates stores when one namespace prefix extends the other", async () => {
        const shared = createMapStorage();
        const a = new LocalStorageKeyValueStore({
            storage: shared,
            prefix: "a",
        });
        const ab = new LocalStorageKeyValueStore({
            storage: shared,
            prefix: "ab",
        });

        await a.set("bc", "from-a");
        await ab.set("c", "from-ab");

        expect(shared.length).toBe(2);
        expect(await a.get("bc")).toBe("from-a");
        expect(await ab.get("c")).toBe("from-ab");
        expect(await a.entries()).toEqual([["bc", "from-a"]]);
        expect(await ab.entries()).toEqual([["c", "from-ab"]]);

        await a.remove("bc");
        expect(await ab.get("c")).toBe("from-ab");
    });

    it("resolves globalThis.localStorage when no Storage is injected", async () => {
        Reflect.set(globalThis, "localStorage", createMapStorage());
        try {
            const kv = new LocalStorageKeyValueStore();
            await kv.set("a", { n: 1 });
            expect(await kv.get("a")).toEqual({ n: 1 });
        } finally {
            Reflect.deleteProperty(globalThis, "localStorage");
        }
    });

    it("throws in the constructor when no Storage is available", () => {
        if (typeof globalThis.localStorage !== "undefined") {
            return; // environment provides localStorage; not applicable
        }
        expect(() => new LocalStorageKeyValueStore()).toThrow(
            /no Storage available/,
        );
    });
});
