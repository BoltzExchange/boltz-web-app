import { LocalStorageKeyValueStore } from "boltz-swaps/storage";
import { describe, expect, it, vi } from "vitest";

import { setLogger } from "../../src/logger.ts";
import { createFakeStorage } from "./fakeStorage.ts";

describe("LocalStorageKeyValueStore", () => {
    it("round-trips values through an injected Storage", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createFakeStorage(),
        });
        await kv.set("a", { n: 1 });
        expect(await kv.get("a")).toEqual({ n: 1 });
    });

    it("returns undefined for a missing key and distinguishes a stored 0", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createFakeStorage(),
        });
        expect(await kv.get("missing")).toBeUndefined();
        await kv.set("zero", 0);
        expect(await kv.get<number>("zero")).toBe(0);
    });

    it("removes a key", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createFakeStorage(),
        });
        await kv.set("a", 1);
        await kv.remove("a");
        expect(await kv.get("a")).toBeUndefined();
    });

    it("treats set(undefined) as a removal instead of poisoning the key", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createFakeStorage(),
        });
        await kv.set("a", 1);
        await kv.set("a", undefined);
        expect(await kv.get("a")).toBeUndefined();
        expect((await kv.entries()).length).toBe(0);
    });

    it("tolerates a corrupt value: get returns undefined and entries skips it", async () => {
        const storage = createFakeStorage();
        const kv = new LocalStorageKeyValueStore({ storage, prefix: "boltz." });
        await kv.set("good", { ok: true });
        storage.setItem("boltz.bad", "{not valid json"); // partial/foreign write
        expect(await kv.get("bad")).toBeUndefined();
        expect((await kv.entries()).map(([k]) => k)).toEqual(["good"]);
    });

    it("enumerates entries by logical prefix, stripping the store prefix", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createFakeStorage(),
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
        const storage = createFakeStorage();
        const kv = new LocalStorageKeyValueStore({ storage, prefix: "boltz." });
        await kv.set("deposit.1", { id: 1 });
        await kv.set("deposit.2", { id: 2 });
        await kv.set("watermark.POL", 10);
        storage.setItem("boltz.deposit.bad", "{not json");
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
            const storage = createFakeStorage();
            const kv = new LocalStorageKeyValueStore({
                storage,
                prefix: "boltz.",
            });
            storage.setItem("boltz.bad", "{nope");
            expect(await kv.get("bad")).toBeUndefined();
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining("corrupt"),
                expect.objectContaining({ key: "boltz.bad" }),
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

    // Exercises the null-key (line 83) and null-raw (line 91) defensive skips
    // that createFakeStorage cannot produce at an in-range index.
    it("skips null keys and null raw values in entries() without throwing", async () => {
        const keys: Array<string | null> = [null, "boltz.good", "boltz.gone"];
        const double = {
            length: keys.length,
            key: (i: number) => keys[i] ?? null,
            getItem: (k: string) =>
                k === "boltz.good" ? JSON.stringify({ ok: true }) : null,
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
        const shared = createFakeStorage();
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

    it("resolves globalThis.localStorage when no Storage is injected", async () => {
        Reflect.set(globalThis, "localStorage", createFakeStorage());
        try {
            const kv = new LocalStorageKeyValueStore();
            await kv.set("a", { n: 1 });
            expect(await kv.get("a")).toEqual({ n: 1 });
        } finally {
            Reflect.deleteProperty(globalThis, "localStorage");
        }
    });

    it("throws when no Storage is available", () => {
        if (typeof globalThis.localStorage !== "undefined") {
            return; // environment provides localStorage; not applicable
        }
        const kv = new LocalStorageKeyValueStore();
        expect(() => kv.get("x")).toThrow(/no Storage available/);
    });
});
