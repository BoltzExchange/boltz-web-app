import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as derivation from "../../src/deposit/derivation.ts";
import * as detect from "../../src/deposit/detect.ts";
import * as engine from "../../src/deposit/engine.ts";
import {
    DEPOSIT_SOURCE_ASSETS,
    DepositPhase,
    type DepositRecord,
    type DepositSourceAsset,
    type DepositStorage,
} from "../../src/deposit/types.ts";

vi.mock("../../src/deposit/derivation.ts", () => ({
    deriveDepositAccount: vi.fn((_m: string, i: number) => ({
        address: `0xADDR${i}`,
    })),
}));

vi.mock("../../src/deposit/detect.ts", () => ({
    getLatestBlock: vi.fn(async () => 100),
    scanIncomingTransfers: vi.fn(async () => []),
}));

vi.mock("../../src/deposit/engine.ts", () => ({
    advanceDeposit: vi.fn(async () => undefined),
}));

// Import after mocks are registered.
const { createWatcher, resumeWatcher } =
    await import("../../src/deposit/watcher.ts");

const MNEMONIC = "test mnemonic";

const flush = () => new Promise((r) => setTimeout(r, 0));
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

type FakeStorage = {
    [K in keyof DepositStorage]: ReturnType<typeof vi.fn>;
};

const makeStorage = (over: Partial<FakeStorage> = {}): FakeStorage => ({
    getWatermark: vi.fn(async () => undefined),
    setWatermark: vi.fn(async () => undefined),
    putDeposit: vi.fn(async () => undefined),
    getDeposit: vi.fn(async () => undefined),
    listActiveDeposits: vi.fn(async () => []),
    ...over,
});

const baseArgs = (over: Record<string, unknown> = {}) => ({
    mnemonic: MNEMONIC,
    storage: makeStorage(),
    resolveOut: vi.fn(),
    approveQuote: vi.fn(),
    ...over,
});

const rec = (
    id: string,
    phase: DepositPhase = DepositPhase.Locking,
): DepositRecord => ({
    id,
    phase,
    sourceAsset: "USDC-POL",
    address: "0xADDR0",
    index: 0,
    createdAt: 0,
    updatedAt: 0,
    amount: "1",
    txHash: "0x",
    logIndex: 0,
    blockNumber: 0,
});

const transfer = (
    txHash: string,
    logIndex: number,
    blockNumber: number,
    amount: bigint,
) => ({ txHash, logIndex, blockNumber, amount, from: "0x1" });

const aborted = (): AbortSignal => {
    const ac = new AbortController();
    ac.abort();
    return ac.signal;
};

const advanceDeposit = vi.mocked(engine.advanceDeposit);
const getLatestBlock = vi.mocked(detect.getLatestBlock);
const scanIncomingTransfers = vi.mocked(detect.scanIncomingTransfers);
const deriveDepositAccount = vi.mocked(derivation.deriveDepositAccount);

// Resume runs before any scan loop and has no signal guard, so a pre-aborted
// signal lets us exercise resume/mutex/spawn without touching the poll loops.
const captureRunExclusive = async () => {
    let captured: { runExclusive: <T>(fn: () => Promise<T>) => Promise<T> };
    advanceDeposit.mockImplementation((async (_r: never, d: never) => {
        captured = d;
    }) as never);
    const storage = makeStorage({
        listActiveDeposits: vi.fn(async () => [rec("a")]),
    });
    await resumeWatcher(baseArgs({ storage, signal: aborted() }) as never);
    await flush();
    return captured!.runExclusive;
};

describe("deposit watcher", () => {
    beforeEach(() => {
        deriveDepositAccount.mockReset().mockImplementation(((
            _m: string,
            i?: number,
        ) => ({
            address: `0xADDR${i}`,
        })) as never);
        getLatestBlock.mockReset().mockResolvedValue(100);
        scanIncomingTransfers.mockReset().mockResolvedValue([]);
        advanceDeposit.mockReset().mockResolvedValue(undefined as never);
    });
    afterEach(() => vi.clearAllMocks());

    describe("createMutex", () => {
        it("serializes: a second fn does not start until the first settles", async () => {
            const rx = await captureRunExclusive();
            const order: string[] = [];
            let releaseA!: () => void;
            const a = rx(
                () =>
                    new Promise<void>((res) => {
                        releaseA = () => {
                            order.push("a");
                            res();
                        };
                    }),
            );
            const b = rx(async () => {
                order.push("b");
            });
            await flush();
            expect(order).toEqual([]); // first still pending -> b hasn't run
            releaseA();
            await Promise.all([a, b]);
            expect(order).toEqual(["a", "b"]);
        });

        it("reject-continuation: a throwing fn still lets the next run (no deadlock)", async () => {
            const rx = await captureRunExclusive();
            const order: string[] = [];
            const a = rx(async () => {
                order.push("a");
                throw new Error("boom");
            }).catch(() => {});
            const b = rx(async () => {
                order.push("b");
            });
            await Promise.all([a, b]);
            expect(order).toEqual(["a", "b"]);
        });
    });

    describe("spawn", () => {
        it("resume error isolation: one rejecting record does not stop the others; error reaches onError", async () => {
            advanceDeposit.mockImplementation((async (r: { id: string }) => {
                if (r.id === "bad") {
                    throw new Error("engine fail");
                }
            }) as never);
            const storage = makeStorage({
                listActiveDeposits: vi.fn(async () => [
                    rec("a"),
                    rec("bad"),
                    rec("c"),
                ]),
            });
            const onError = vi.fn();
            await resumeWatcher(
                baseArgs({ storage, onError, signal: aborted() }) as never,
            );
            await flush();

            expect(advanceDeposit).toHaveBeenCalledTimes(3);
            expect(advanceDeposit.mock.calls.map((c) => c[0].id)).toEqual([
                "a",
                "bad",
                "c",
            ]);
            expect(onError).toHaveBeenCalledTimes(1);
            expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
        });

        it("running-Set dedups duplicate ids (advance once)", async () => {
            advanceDeposit.mockImplementation(() => new Promise(() => {}));
            const storage = makeStorage({
                listActiveDeposits: vi.fn(async () => [rec("dup"), rec("dup")]),
            });
            await resumeWatcher(
                baseArgs({ storage, signal: aborted() }) as never,
            );
            await flush();
            expect(advanceDeposit).toHaveBeenCalledTimes(1);
        });
    });

    describe("resume-flag gating", () => {
        it("createWatcher does not list active deposits", async () => {
            const storage = makeStorage();
            await createWatcher(
                baseArgs({ storage, signal: aborted() }) as never,
            );
            await flush();
            expect(storage.listActiveDeposits).not.toHaveBeenCalled();
        });

        it("resumeWatcher lists active deposits and spawns each", async () => {
            const storage = makeStorage({
                listActiveDeposits: vi.fn(async () => [rec("a"), rec("b")]),
            });
            await resumeWatcher(
                baseArgs({ storage, signal: aborted() }) as never,
            );
            await flush();
            expect(storage.listActiveDeposits).toHaveBeenCalledTimes(1);
            expect(advanceDeposit.mock.calls.map((c) => c[0].id)).toEqual([
                "a",
                "b",
            ]);
        });
    });

    describe("index isolation & reconcile", () => {
        it("resume only spawns records for its own derivation index", async () => {
            const storage = makeStorage({
                listActiveDeposits: vi.fn(async () => [
                    rec("a"), // index 0 — ours
                    { ...rec("b"), index: 1 }, // another index — skip
                    rec("c"), // index 0 — ours
                ]),
            });
            await resumeWatcher(
                baseArgs({ storage, signal: aborted() }) as never,
            );
            await flush();
            // Driving index-1's record with our index-0 account would sign its
            // burn/lock with the wrong address.
            expect(advanceDeposit.mock.calls.map((c) => c[0].id)).toEqual([
                "a",
                "c",
            ]);
        });

        it("re-spawns a deposit whose engine dropped out on a transient error", async () => {
            let calls = 0;
            advanceDeposit.mockImplementation((async (r: { id: string }) => {
                calls++;
                if (calls === 1 && r.id === "x") {
                    throw new Error("transient");
                }
            }) as never);
            const storage = makeStorage({
                listActiveDeposits: vi.fn(async () => [rec("x")]),
            });
            const watcher = await resumeWatcher(
                baseArgs({
                    storage,
                    onError: vi.fn(),
                    sourceAssets: [], // isolate the reconcile loop
                    pollIntervalMs: 5,
                }) as never,
            );
            // Initial reconcile spawns once and it throws; the reconcile loop
            // must re-spawn it rather than stranding it until a restart.
            await tick(30);
            watcher.stop();
            expect(calls).toBeGreaterThanOrEqual(2);
        });
    });

    describe("from-block precedence (watermark ?? startBlocks ?? latest)", () => {
        const runSingleScan = async (over: Record<string, unknown>) => {
            const ac = new AbortController();
            const storage = makeStorage({
                setWatermark: vi.fn(async () => {
                    ac.abort();
                }),
                ...((over.storageOver as Partial<FakeStorage>) ?? {}),
            });
            await createWatcher(
                baseArgs({
                    storage,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                    confirmations: { "USDC-POL": 0 },
                    ...over,
                }) as never,
            );
            await tick();
            return storage;
        };

        it("honors a stored watermark of 0 (?? not ||)", async () => {
            getLatestBlock.mockResolvedValue(100);
            await runSingleScan({
                storageOver: { getWatermark: vi.fn(async () => 0) },
            });
            expect(scanIncomingTransfers).toHaveBeenCalledWith(
                expect.objectContaining({ fromBlock: 0, toBlock: 100 }),
            );
        });

        it("uses startBlocks when watermark is undefined", async () => {
            getLatestBlock.mockResolvedValue(100);
            await runSingleScan({
                startBlocks: { "USDC-POL": 50 },
            });
            expect(scanIncomingTransfers).toHaveBeenCalledWith(
                expect.objectContaining({ fromBlock: 50, toBlock: 100 }),
            );
        });

        it("starts at latest when both watermark and startBlocks are undefined", async () => {
            getLatestBlock.mockResolvedValue(100);
            await runSingleScan({});
            expect(scanIncomingTransfers).toHaveBeenCalledWith(
                expect.objectContaining({ fromBlock: 100, toBlock: 100 }),
            );
        });
    });

    describe("watermark advancement", () => {
        it("scans and watermarks to the confirmed tip (latest - confirmations)", async () => {
            const ac = new AbortController();
            getLatestBlock.mockResolvedValue(100);
            const storage = makeStorage({
                getWatermark: vi.fn(async () => 0),
                setWatermark: vi.fn(async () => {
                    ac.abort();
                }),
            });
            await createWatcher(
                baseArgs({
                    storage,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                    confirmations: { "USDC-POL": 10 },
                }) as never,
            );
            await tick(20);

            // A transfer in blocks 91..100 (the unconfirmed tip) must not be
            // acted on: only 0..90 is scanned and the watermark stops at 90.
            expect(scanIncomingTransfers).toHaveBeenCalledWith(
                expect.objectContaining({ fromBlock: 0, toBlock: 90 }),
            );
            expect(storage.setWatermark).toHaveBeenCalledWith("USDC-POL", 90);
        });

        it("an RPC error leaves the watermark unmoved and the loop survives", async () => {
            const ac = new AbortController();
            let calls = 0;
            getLatestBlock.mockImplementation(async () => {
                calls++;
                if (calls >= 2) {
                    ac.abort();
                }
                throw new Error("rpc");
            });
            const storage = makeStorage();
            const onError = vi.fn();
            await createWatcher(
                baseArgs({
                    storage,
                    onError,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick(20);

            expect(onError).toHaveBeenCalled();
            expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(calls).toBeGreaterThanOrEqual(2); // loop survived the throw
            expect(scanIncomingTransfers).not.toHaveBeenCalled();
            expect(storage.setWatermark).not.toHaveBeenCalled();
        });

        it("a reorg (latest < from) skips scan and the watermark write", async () => {
            const ac = new AbortController();
            getLatestBlock.mockImplementation(async () => {
                ac.abort();
                return 100;
            });
            const storage = makeStorage({
                getWatermark: vi.fn(async () => 200),
            });
            await createWatcher(
                baseArgs({
                    storage,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick(20);

            expect(scanIncomingTransfers).not.toHaveBeenCalled();
            expect(storage.setWatermark).not.toHaveBeenCalled();
        });
    });

    describe("per-transfer handling", () => {
        it("skips a transfer whose id already has a record; persists a new one", async () => {
            const ac = new AbortController();
            const storage = makeStorage({
                getDeposit: vi.fn(async (id) =>
                    id === "0xaa:1" ? ({} as DepositRecord) : undefined,
                ),
                setWatermark: vi.fn(async () => {
                    ac.abort();
                }),
            });
            scanIncomingTransfers.mockResolvedValue([
                transfer("0xaa", 1, 5, 1000000n),
                transfer("0xbb", 0, 6, 2000000n),
            ]);
            await createWatcher(
                baseArgs({
                    storage,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick();

            expect(storage.putDeposit).toHaveBeenCalledTimes(1);
            expect(storage.putDeposit.mock.calls[0][0].id).toBe("0xbb:0");
            expect(advanceDeposit).toHaveBeenCalledTimes(1);
            expect(advanceDeposit.mock.calls[0][0].id).toBe("0xbb:0");
        });

        it("maps transfer fields onto a Detected record (amount bigint -> string)", async () => {
            const ac = new AbortController();
            const storage = makeStorage({
                setWatermark: vi.fn(async () => {
                    ac.abort();
                }),
            });
            scanIncomingTransfers.mockResolvedValue([
                transfer("0xdead", 2, 7, 123456789n),
            ]);
            await createWatcher(
                baseArgs({
                    storage,
                    index: 3,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick();

            const record = storage.putDeposit.mock.calls[0][0];
            expect(record).toMatchObject({
                id: "0xdead:2",
                phase: DepositPhase.Detected,
                sourceAsset: "USDC-POL",
                amount: "123456789",
                txHash: "0xdead",
                logIndex: 2,
                blockNumber: 7,
                index: 3,
                address: "0xADDR3",
            });
            expect(typeof record.amount).toBe("string");
        });

        it("emits onEvent(Detected) after putDeposit and before spawn", async () => {
            const ac = new AbortController();
            const onEvent = vi.fn();
            const storage = makeStorage({
                setWatermark: vi.fn(async () => {
                    ac.abort();
                }),
            });
            scanIncomingTransfers.mockResolvedValue([
                transfer("0xbb", 0, 6, 2000000n),
            ]);
            await createWatcher(
                baseArgs({
                    storage,
                    onEvent,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick();

            expect(onEvent).toHaveBeenCalledTimes(1);
            expect(onEvent.mock.calls[0][0].phase).toBe(DepositPhase.Detected);
            expect(storage.putDeposit.mock.invocationCallOrder[0]).toBeLessThan(
                onEvent.mock.invocationCallOrder[0],
            );
            expect(onEvent.mock.invocationCallOrder[0]).toBeLessThan(
                advanceDeposit.mock.invocationCallOrder[0],
            );
        });
    });

    describe("per-asset scan loops", () => {
        it("starts one loop per custom sourceAsset", async () => {
            const ac = new AbortController();
            const seen = new Set<string>();
            getLatestBlock.mockImplementation(async (asset) => {
                seen.add(asset);
                if (seen.size >= 2) {
                    ac.abort();
                }
                return 100;
            });
            const storage = makeStorage();
            await createWatcher(
                baseArgs({
                    storage,
                    signal: ac.signal,
                    sourceAssets: ["USDC-POL", "USDC-BASE"],
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick(20);

            expect(new Set(getLatestBlock.mock.calls.map((c) => c[0]))).toEqual(
                new Set(["USDC-POL", "USDC-BASE"]),
            );
            expect(
                new Set(
                    storage.getWatermark.mock.calls.map((c) => c[0] as string),
                ),
            ).toEqual(new Set(["USDC-POL", "USDC-BASE"]));
        });

        it("defaults to all of DEPOSIT_SOURCE_ASSETS (3)", async () => {
            const ac = new AbortController();
            const seen = new Set<string>();
            getLatestBlock.mockImplementation(async (asset) => {
                seen.add(asset);
                if (seen.size >= DEPOSIT_SOURCE_ASSETS.length) {
                    ac.abort();
                }
                return 100;
            });
            const storage = makeStorage();
            await createWatcher(
                baseArgs({
                    storage,
                    signal: ac.signal,
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick(20);

            expect(new Set(getLatestBlock.mock.calls.map((c) => c[0]))).toEqual(
                new Set<DepositSourceAsset>(DEPOSIT_SOURCE_ASSETS),
            );
        });
    });

    describe("abort / stop lifecycle", () => {
        it("a pre-aborted signal exits every scan loop immediately yet resume still spawns", async () => {
            const storage = makeStorage({
                listActiveDeposits: vi.fn(async () => [rec("a")]),
            });
            await resumeWatcher(
                baseArgs({
                    storage,
                    signal: aborted(),
                    pollIntervalMs: 1,
                }) as never,
            );
            await tick();

            expect(getLatestBlock).not.toHaveBeenCalled();
            expect(scanIncomingTransfers).not.toHaveBeenCalled();
            expect(advanceDeposit).toHaveBeenCalledTimes(1);
        });

        it("stop() halts polling (call count stops growing)", async () => {
            getLatestBlock.mockResolvedValue(100);
            scanIncomingTransfers.mockResolvedValue([]);
            const storage = makeStorage();
            const w = await createWatcher(
                baseArgs({
                    storage,
                    sourceAssets: ["USDC-POL"],
                    pollIntervalMs: 5,
                }) as never,
            );
            await tick(20);
            w.stop();
            await tick(30);
            const m = getLatestBlock.mock.calls.length;
            await tick(30);
            expect(getLatestBlock.mock.calls.length).toBe(m);
        });
    });

    describe("index default and passthrough", () => {
        it("passes an explicit index to derivation and the returned watcher", async () => {
            const w = await createWatcher(
                baseArgs({ signal: aborted(), index: 5 }) as never,
            );
            expect(deriveDepositAccount).toHaveBeenCalledWith(MNEMONIC, 5);
            expect(w.index).toBe(5);
            expect(w.address).toBe("0xADDR5");
        });

        it("defaults index to 0", async () => {
            const w = await createWatcher(
                baseArgs({ signal: aborted() }) as never,
            );
            expect(deriveDepositAccount).toHaveBeenCalledWith(MNEMONIC, 0);
            expect(w.index).toBe(0);
            expect(w.address).toBe("0xADDR0");
        });
    });
});
