import { fuzzyScore, fuzzySort } from "../../src/utils/search";

describe("fuzzyScore", () => {
    test("should match exact prefix", () => {
        expect(fuzzyScore("arb", "Arbitrum")).toBe(3);
    });

    test("should match case insensitively", () => {
        expect(fuzzyScore("ARB", "arbitrum")).toBe(3);
        expect(fuzzyScore("arb", "ARBITRUM")).toBe(3);
    });

    test("should return null for no match", () => {
        expect(fuzzyScore("xyz", "Arbitrum")).toBeNull();
    });

    test("should return null for partial match", () => {
        expect(fuzzyScore("arbz", "Arbitrum")).toBeNull();
    });

    test("should penalize gaps", () => {
        const prefix = fuzzyScore("arb", "Arbitrum");
        const gapped = fuzzyScore("arm", "Arbitrum");
        expect(prefix).toBeLessThan(gapped);
    });

    test("should return score of 1 for single char match at start", () => {
        expect(fuzzyScore("a", "Arbitrum")).toBe(1);
    });

    test("should return score for non-prefix match", () => {
        expect(fuzzyScore("bit", "Arbitrum")).not.toBeNull();
    });

    test("should return null for empty target", () => {
        expect(fuzzyScore("a", "")).toBeNull();
    });

    test("should match with empty query", () => {
        expect(fuzzyScore("", "Arbitrum")).toBe(0);
    });
});

describe("fuzzySort", () => {
    const networks = [
        "Arbitrum",
        "Berachain",
        "Ethereum",
        "Optimism",
        "Polygon PoS",
    ];

    test("should return all items for empty query", () => {
        expect(fuzzySort(networks, "", (n) => n)).toEqual(networks);
    });

    test("should filter out non-matches", () => {
        const result = fuzzySort(networks, "xyz", (n) => n);
        expect(result).toEqual([]);
    });

    test("should rank prefix matches first", () => {
        const result = fuzzySort(networks, "eth", (n) => n);
        expect(result[0]).toBe("Ethereum");
    });

    test("should rank tighter matches higher", () => {
        const result = fuzzySort(networks, "op", (n) => n);
        expect(result[0]).toBe("Optimism");
    });

    test("should work with object items and getText", () => {
        const items = [
            { id: 1, name: "Ethereum" },
            { id: 2, name: "Optimism" },
        ];
        const result = fuzzySort(items, "eth", (i) => i.name);
        expect(result).toEqual([{ id: 1, name: "Ethereum" }]);
    });
});
