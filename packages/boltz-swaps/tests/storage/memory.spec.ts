import { MemoryKeyValueStore } from "boltz-swaps/storage";
import { describe, expect, it } from "vitest";

// Every legitimate in-memory use must acknowledge the production risk.
const store = () =>
    new MemoryKeyValueStore({
        inMemoryStorageShouldNeverBeUsedInProduction: true,
    });

describe("MemoryKeyValueStore", () => {
    it("refuses construction without the production acknowledgment", () => {
        // @ts-expect-error — the acknowledgment argument is required
        expect(() => new MemoryKeyValueStore()).toThrow(/in-memory/i);
        expect(
            () =>
                new MemoryKeyValueStore({
                    inMemoryStorageShouldNeverBeUsedInProduction: false,
                }),
        ).toThrow(/inMemoryStorageShouldNeverBeUsedInProduction/);
    });

    it("returns undefined for a missing key", async () => {
        expect(await store().get("missing")).toBeUndefined();
    });

    it("round-trips values", async () => {
        const kv = store();
        await kv.set("a", { n: 1, s: "x" });
        expect(await kv.get("a")).toEqual({ n: 1, s: "x" });
    });

    it("distinguishes a stored 0 from a missing key", async () => {
        const kv = store();
        await kv.set("zero", 0);
        expect(await kv.get<number>("zero")).toBe(0);
        expect(await kv.get("absent")).toBeUndefined();
    });

    it("removes a key", async () => {
        const kv = store();
        await kv.set("a", 1);
        await kv.remove("a");
        expect(await kv.get("a")).toBeUndefined();
    });

    it("treats set(undefined) as a removal (no phantom entry)", async () => {
        const kv = store();
        await kv.set("a", 1);
        await kv.set("a", undefined);
        expect(await kv.get("a")).toBeUndefined();
        expect((await kv.entries()).length).toBe(0);
    });

    it("enumerates entries filtered by prefix", async () => {
        const kv = store();
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
        const kv = store();
        const input = { n: 1 };
        await kv.set("a", input);
        input.n = 99; // mutate after storing
        const first = await kv.get<{ n: number }>("a");
        expect(first?.n).toBe(1);
        first!.n = 42; // mutate the returned copy
        expect((await kv.get<{ n: number }>("a"))?.n).toBe(1);
    });

    it("returns defensive copies from entries() (mutations do not leak)", async () => {
        const kv = store();
        await kv.set("a.1", { n: 1 });
        const e = await kv.entries<{ n: number }>("a.");
        e[0][1].n = 99;
        expect((await kv.get<{ n: number }>("a.1"))?.n).toBe(1);
    });
});
