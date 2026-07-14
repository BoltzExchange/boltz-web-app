import { MemoryKeyValueStore } from "boltz-swaps/storage";
import { describe, expect, it } from "vitest";

// The behavioral contract lives in parity.spec.ts; only the construction
// guard is unique to this store.
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
});
