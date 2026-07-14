import { getTokenAddress, setBoltzSwapsConfig } from "boltz-swaps/config";
import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { erc20Abi } from "../../src/generated/evm-abis.ts";

const getLogs = vi.fn(
    async (_args: Record<string, unknown>) => [] as unknown[],
);
const getBlockNumber = vi.fn(async () => 0n);
const readContract = vi.fn(async () => 0n);

vi.mock("../../src/evm/provider.ts", () => ({
    createAssetProvider: vi.fn(() => ({
        getLogs,
        getBlockNumber,
        readContract,
    })),
}));

const LOWER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const CHECKSUM = getAddress(LOWER);

const { scanIncomingTransfers, getLatestBlock, readSourceTokenBalance } =
    await import("../../src/deposit/detect.ts");

describe("deposit detect", () => {
    beforeEach(() => {
        setBoltzSwapsConfig(buildMainnetConfig());
    });
    afterEach(() => {
        vi.clearAllMocks();
        getLogs.mockResolvedValue([]);
    });

    it("windows [0,toBlock] as contiguous ascending bigint ranges", async () => {
        await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: LOWER,
            fromBlock: 0,
            toBlock: 12000,
        });

        const windows = getLogs.mock.calls.map((c) => ({
            f: (c[0] as { fromBlock: bigint }).fromBlock,
            t: (c[0] as { toBlock: bigint }).toBlock,
        }));

        expect(windows.length).toBeGreaterThan(0);
        for (const w of windows) {
            expect(typeof w.f).toBe("bigint");
            expect(typeof w.t).toBe("bigint");
        }

        const sorted = [...windows].sort((a, b) => (a.f < b.f ? -1 : 1));
        const minF = windows.reduce((m, w) => (w.f < m ? w.f : m), sorted[0].f);
        const maxT = windows.reduce((m, w) => (w.t > m ? w.t : m), sorted[0].t);
        expect(minF).toBe(0n);
        expect(maxT).toBe(12000n);
        expect(sorted[0].f).toBe(0n);
        expect(sorted[sorted.length - 1].t).toBe(12000n);
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].f).toBe(sorted[i - 1].t + 1n);
        }
    });

    it("returns [] and skips getLogs for an inverted window", async () => {
        const result = await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: CHECKSUM,
            fromBlock: 5000,
            toBlock: 4999,
        });
        expect(result).toEqual([]);
        expect(getLogs).not.toHaveBeenCalled();
    });

    it("drops pending logs (null txHash) and keeps a mined sibling", async () => {
        getLogs.mockResolvedValueOnce([
            {
                transactionHash: null,
                logIndex: null,
                blockNumber: 1n,
                args: { from: "0xaaa", value: 5n },
            },
            {
                transactionHash: "0xabc",
                logIndex: 2,
                blockNumber: 1n,
                args: { from: "0xbbb", value: 7n },
            },
        ] as never);

        const result = await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: LOWER,
            fromBlock: 1,
            toBlock: 1,
        });
        expect(result).toHaveLength(1);
        expect(result[0].txHash).toBe("0xabc");
        expect(result[0].logIndex).toBe(2);
    });

    it("drops a pending log with only logIndex null (proves the OR)", async () => {
        getLogs.mockResolvedValueOnce([
            {
                transactionHash: "0xdef",
                logIndex: null,
                blockNumber: 1n,
                args: { from: "0xccc", value: 9n },
            },
        ] as never);

        const result = await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: LOWER,
            fromBlock: 1,
            toBlock: 1,
        });
        expect(result).toEqual([]);
    });

    it("maps fields with '' / 0n defaults and bigint→Number block", async () => {
        getLogs.mockResolvedValueOnce([
            {
                transactionHash: "0xaa",
                logIndex: 3,
                blockNumber: 7n,
                args: { from: undefined, value: undefined },
            },
            {
                transactionHash: "0xbb",
                logIndex: 0,
                blockNumber: 8n,
                args: { from: "0xSENDER", value: 1234567n },
            },
        ] as never);

        const result = await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: LOWER,
            fromBlock: 7,
            toBlock: 8,
        });
        expect(result[0]).toEqual({
            txHash: "0xaa",
            logIndex: 3,
            blockNumber: 7,
            from: "",
            amount: 0n,
        });
        expect(typeof result[0].blockNumber).toBe("number");
        expect(result[1]).toEqual({
            txHash: "0xbb",
            logIndex: 0,
            blockNumber: 8,
            from: "0xSENDER",
            amount: 1234567n,
        });
    });

    it("aggregates transfers across multiple ranges", async () => {
        getLogs
            .mockResolvedValueOnce([
                {
                    transactionHash: "0x1",
                    logIndex: 0,
                    blockNumber: 11000n,
                    args: { from: "0xa", value: 1n },
                },
            ] as never)
            .mockResolvedValueOnce([
                {
                    transactionHash: "0x2",
                    logIndex: 0,
                    blockNumber: 1n,
                    args: { from: "0xb", value: 2n },
                },
            ] as never);

        const result = await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: LOWER,
            fromBlock: 0,
            toBlock: 12000,
        });
        const hashes = result.map((t) => t.txHash);
        expect(hashes.length).toBeGreaterThanOrEqual(2);
        expect(hashes).toContain("0x1");
        expect(hashes).toContain("0x2");
    });

    it("filters getLogs by checksummed token, checksummed recipient, Transfer event", async () => {
        await scanIncomingTransfers({
            sourceAsset: "USDC-POL",
            address: LOWER,
            fromBlock: 1,
            toBlock: 1,
        });
        const arg = getLogs.mock.calls[0][0] as {
            address: string;
            args: { to: string };
            event: { name: string };
        };
        expect(arg.address).toBe(getAddress(getTokenAddress("USDC-POL")));
        expect(arg.args.to).toBe(CHECKSUM);
        expect(arg.event.name).toBe("Transfer");
    });

    it("getLatestBlock coerces the bigint head to a number", async () => {
        getBlockNumber.mockResolvedValueOnce(123n);
        const result = await getLatestBlock("USDC-POL");
        expect(result).toBe(123);
        expect(typeof result).toBe("number");
    });

    it("readSourceTokenBalance reads balanceOf with checksummed token and holder", async () => {
        readContract.mockResolvedValueOnce(42n);
        const result = await readSourceTokenBalance("USDC-POL", LOWER);
        expect(result).toBe(42n);
        expect(readContract).toHaveBeenCalledWith({
            address: getAddress(getTokenAddress("USDC-POL")),
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [CHECKSUM],
        });
    });
});
