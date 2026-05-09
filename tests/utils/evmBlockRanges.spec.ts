import {
    type BlockRange,
    defaultScanInterval,
    generateBlockRangeBatches,
    parallelBatchSize,
} from "../../src/utils/evmBlockRanges";

const collect = (
    ...args: Parameters<typeof generateBlockRangeBatches>
): BlockRange[][] => Array.from(generateBlockRangeBatches(...args));

describe("generateBlockRangeBatches", () => {
    test("yields the latest block in the first range of the first batch", () => {
        const batches = collect(1_000_000, 0, 2_000, 5);
        expect(batches[0][0].toBlock).toBe(1_000_000);
        expect(batches[0][0].fromBlock).toBe(998_001);
    });

    test("walks toBlock strictly downward across yielded ranges", () => {
        const ranges = collect(50_000, 0, 1_000, 5).flat();
        for (let i = 1; i < ranges.length; i++) {
            expect(ranges[i].toBlock).toBeLessThan(ranges[i - 1].toBlock);
        }
    });

    test("each range covers exactly intervalSize blocks except where clipped to minBlock", () => {
        const intervalSize = 1_000;
        const minBlock = 12_345;
        const ranges = collect(60_000, minBlock, intervalSize, 5).flat();

        for (const { fromBlock, toBlock } of ranges) {
            expect(fromBlock).toBeLessThanOrEqual(toBlock);
            expect(fromBlock).toBeGreaterThanOrEqual(minBlock);
            const span = toBlock - fromBlock + 1;
            expect(span).toBeLessThanOrEqual(intervalSize);
        }

        const last = ranges[ranges.length - 1];
        expect(last.fromBlock).toBe(minBlock);
    });

    test("packs each batch with up to parallelBatchSize ranges and no more", () => {
        const batchSize = 4;
        const batches = collect(20_000, 0, 1_000, batchSize);
        for (const batch of batches.slice(0, -1)) {
            expect(batch).toHaveLength(batchSize);
        }
        expect(batches[batches.length - 1].length).toBeGreaterThan(0);
        expect(batches[batches.length - 1].length).toBeLessThanOrEqual(
            batchSize,
        );
    });

    test("does not yield ranges that extend below minBlock", () => {
        const minBlock = 100;
        const ranges = collect(5_000, minBlock, 700, 3).flat();
        for (const { fromBlock } of ranges) {
            expect(fromBlock).toBeGreaterThanOrEqual(minBlock);
        }
    });

    test("yields adjacent, non-overlapping ranges", () => {
        const ranges = collect(10_000, 0, 1_000, 5).flat();
        for (let i = 1; i < ranges.length; i++) {
            // Ranges walk from latest downward, so each range ends one block
            // below the previous one's start.
            expect(ranges[i].toBlock).toBe(ranges[i - 1].fromBlock - 1);
        }
    });

    test("yields a single one-block range when latestBlock equals minBlock", () => {
        const batches = collect(42, 42, 1_000, 5);
        expect(batches).toEqual([[{ fromBlock: 42, toBlock: 42 }]]);
    });

    test("yields nothing when latestBlock is below minBlock", () => {
        expect(collect(99, 100, 1_000, 5)).toEqual([]);
    });

    test("uses the exported defaults when interval and batch size are omitted", () => {
        const batches = Array.from(generateBlockRangeBatches(50_000, 0));
        expect(batches[0]).toHaveLength(parallelBatchSize);
        for (const { fromBlock, toBlock } of batches[0]) {
            expect(toBlock - fromBlock + 1).toBe(defaultScanInterval);
        }
    });

    test("covers every block between minBlock and latestBlock exactly once", () => {
        const latestBlock = 9_876;
        const minBlock = 123;
        const ranges = collect(latestBlock, minBlock, 250, 3).flat();
        const seen = new Set<number>();
        for (const { fromBlock, toBlock } of ranges) {
            for (let block = fromBlock; block <= toBlock; block++) {
                expect(seen.has(block)).toBe(false);
                seen.add(block);
            }
        }
        for (let block = minBlock; block <= latestBlock; block++) {
            expect(seen.has(block)).toBe(true);
        }
        expect(seen.size).toBe(latestBlock - minBlock + 1);
    });
});
