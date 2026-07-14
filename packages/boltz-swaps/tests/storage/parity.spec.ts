import {
    type KeyValueStore,
    LocalStorageKeyValueStore,
    MemoryKeyValueStore,
} from "boltz-swaps/storage";
import { describe, expect, it } from "vitest";

import { createMapStorage } from "../../src/storage/memory.ts";

// One behavioral contract run over both stores — any drift between the
// in-memory and durable store fails here.
const stores: Array<[string, () => KeyValueStore]> = [
    [
        "MemoryKeyValueStore",
        () =>
            new MemoryKeyValueStore({
                inMemoryStorageShouldNeverBeUsedInProduction: true,
            }),
    ],
    [
        "LocalStorageKeyValueStore",
        () => new LocalStorageKeyValueStore({ storage: createMapStorage() }),
    ],
];

describe.each(stores)("KeyValueStore parity: %s", (_, make) => {
    it("round-trips a JSON value", async () => {
        const kv = make();
        await kv.set("a", { n: 1, s: "x", nested: { ok: true } });
        expect(await kv.get("a")).toEqual({
            n: 1,
            s: "x",
            nested: { ok: true },
        });
    });

    it("distinguishes stored falsy values from a missing key", async () => {
        const kv = make();
        await kv.set("zero", 0);
        await kv.set("null", null);
        await kv.set("empty", "");
        expect(await kv.get<number>("zero")).toBe(0);
        expect(await kv.get<null>("null")).toBeNull();
        expect(await kv.get<string>("empty")).toBe("");
        expect(await kv.get("absent")).toBeUndefined();
    });

    it("removes a key", async () => {
        const kv = make();
        await kv.set("a", 1);
        await kv.remove("a");
        expect(await kv.get("a")).toBeUndefined();
    });

    it("treats set(undefined) as a removal", async () => {
        const kv = make();
        await kv.set("a", 1);
        await kv.set("a", undefined);
        expect(await kv.get("a")).toBeUndefined();
        expect((await kv.entries()).length).toBe(0);
    });

    it("enumerates entries filtered by prefix", async () => {
        const kv = make();
        await kv.set("deposit.1", { id: 1 });
        await kv.set("deposit.2", { id: 2 });
        await kv.set("watermark.POL", 10);
        const deposits = await kv.entries<{ id: number }>("deposit.");
        expect(deposits.map(([k]) => k).sort()).toEqual([
            "deposit.1",
            "deposit.2",
        ]);
        expect((await kv.entries()).length).toBe(3);
    });

    it("returns defensive copies (mutations do not leak into the store)", async () => {
        const kv = make();
        const input = { n: 1 };
        await kv.set("a", input);
        input.n = 99;
        const first = await kv.get<{ n: number }>("a");
        expect(first?.n).toBe(1);
        first!.n = 42;
        expect((await kv.get<{ n: number }>("a"))?.n).toBe(1);
        const e = await kv.entries<{ n: number }>();
        e[0][1].n = 7;
        expect((await kv.get<{ n: number }>("a"))?.n).toBe(1);
    });

    it("rejects a bigint", async () => {
        await expect(make().set("b", 5n)).rejects.toThrow(TypeError);
    });

    it("normalizes a Date to its ISO string", async () => {
        const kv = make();
        const date = new Date("2026-01-02T03:04:05.000Z");
        await kv.set("d", date);
        expect(await kv.get<string>("d")).toBe("2026-01-02T03:04:05.000Z");
    });

    it("drops undefined object properties", async () => {
        const kv = make();
        await kv.set("a", { keep: 1, drop: undefined });
        expect(await kv.get("a")).toEqual({ keep: 1 });
    });
});
