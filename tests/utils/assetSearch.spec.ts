import {
    findEnabledIndex,
    fuzzyScore,
    fuzzySort,
    handleListKeyDown,
} from "../../src/utils/assetSearch";

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

describe("findEnabledIndex", () => {
    test("should return wrapped start when no predicate is given", () => {
        expect(findEnabledIndex(5, 1, 3)).toBe(2);
        expect(findEnabledIndex(-1, -1, 3)).toBe(2);
    });

    test("should return start unchanged when not disabled", () => {
        const isDisabled = (i: number) => i === 0;
        expect(findEnabledIndex(2, 1, 4, isDisabled)).toBe(2);
    });

    test("should skip forward over disabled indices", () => {
        const isDisabled = (i: number) => i === 1 || i === 2;
        expect(findEnabledIndex(1, 1, 4, isDisabled)).toBe(3);
    });

    test("should skip backward over disabled indices", () => {
        const isDisabled = (i: number) => i === 1 || i === 2;
        expect(findEnabledIndex(2, -1, 4, isDisabled)).toBe(0);
    });

    test("should wrap around when stepping forward off the end", () => {
        const isDisabled = (i: number) => i === 3;
        expect(findEnabledIndex(3, 1, 4, isDisabled)).toBe(0);
    });

    test("should wrap around when stepping backward off the start", () => {
        const isDisabled = (i: number) => i === 0;
        expect(findEnabledIndex(0, -1, 4, isDisabled)).toBe(3);
    });

    test("should fall back when every index is disabled", () => {
        const isDisabled = () => true;
        expect(findEnabledIndex(1, 1, 3, isDisabled)).toBe(1);
    });

    test("should return 0 for empty list", () => {
        expect(findEnabledIndex(5, 1, 0, () => false)).toBe(0);
    });
});

describe("handleListKeyDown", () => {
    const makeEvent = (key: string): KeyboardEvent => {
        const ev = new KeyboardEvent("keydown", { key });
        Object.defineProperty(ev, "target", { value: document.body });
        return ev;
    };

    const drive = (
        startIndex: number,
        key: string,
        length: number,
        isDisabled?: (i: number) => boolean,
    ) => {
        let focused = startIndex;
        handleListKeyDown(
            makeEvent(key),
            length,
            (fn) => {
                focused = fn(focused);
            },
            () => {},
            () => {},
            isDisabled,
        );
        return focused;
    };

    test("ArrowDown skips a disabled neighbour", () => {
        const isDisabled = (i: number) => i === 1;
        expect(drive(0, "ArrowDown", 3, isDisabled)).toBe(2);
    });

    test("ArrowUp skips a disabled neighbour", () => {
        const isDisabled = (i: number) => i === 1;
        expect(drive(2, "ArrowUp", 3, isDisabled)).toBe(0);
    });

    test("ArrowDown wraps past disabled tail", () => {
        const isDisabled = (i: number) => i >= 2;
        expect(drive(1, "ArrowDown", 4, isDisabled)).toBe(0);
    });

    test("ArrowDown advances normally without predicate", () => {
        expect(drive(0, "ArrowDown", 3)).toBe(1);
    });

    test("j and k mirror arrow keys with skipping", () => {
        const isDisabled = (i: number) => i === 1;
        expect(drive(0, "j", 3, isDisabled)).toBe(2);
        expect(drive(2, "k", 3, isDisabled)).toBe(0);
    });

    test("Enter triggers onSelect", () => {
        let called = 0;
        handleListKeyDown(
            makeEvent("Enter"),
            3,
            () => {},
            () => {
                called += 1;
            },
            () => {},
        );
        expect(called).toBe(1);
    });
});
