import { clearCache } from "boltz-swaps/cache";
import { setBoltzSwapsConfig } from "boltz-swaps/config";
import { buildMainnetConfig } from "boltz-swaps/presets/mainnet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingBridgeSendRecoveryStatus } from "../../src/bridge/pendingSend.ts";
import { getSwapStatus } from "../../src/client.ts";
import * as bridge from "../../src/deposit/bridge.ts";
import { advanceDeposit } from "../../src/deposit/engine.ts";
import { DepositRefundableError } from "../../src/deposit/errors.ts";
import * as lockup from "../../src/deposit/lockup.ts";
import * as refund from "../../src/deposit/refund.ts";
import { createMemoryDepositStorage } from "../../src/deposit/storage.ts";
import * as swapOut from "../../src/deposit/swapOut.ts";
import {
    DepositPhase,
    type DepositRecord,
    type DepositStorage,
} from "../../src/deposit/types.ts";
import * as commitment from "../../src/evm/commitment.ts";
import { assetAmountToSats } from "../../src/evm/rootstock.ts";

const EPHEMERAL = { inMemoryStorageShouldNeverBeUsedInProduction: true };

const pending = {
    kind: "evm-cctp",
    createdAt: 0,
    sender: "0x0000000000000000000000000000000000000000",
    fromNonce: 0,
    fromBlock: 0,
    tokenMessenger: "0x0000000000000000000000000000000000000000",
    messageTransmitter: "0x0000000000000000000000000000000000000000",
    calldata: "0x",
};

vi.mock("../../src/deposit/signer.ts", () => ({
    buildDepositSigner: () => ({
        address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    }),
}));

vi.mock("../../src/deposit/bridge.ts", () => ({
    sponsoredCctpBurn: vi.fn(
        async (args: { persistPending: (p: unknown) => Promise<void> }) => {
            await args.persistPending(pending);
            return {
                burnTxHash: "0xburn",
                guid: "7:0xburn",
                cctpNonce: "0x00",
                cctpMessage: "0x",
                pendingSend: pending,
            };
        },
    ),
    awaitCctpMint: vi.fn(async () => ({
        mintedAmount: 990000n,
        blockNumber: 2,
    })),
    manualMint: vi.fn(async () => undefined),
    recoverBurn: vi.fn(),
    deriveCctpGuid: vi.fn((_asset: string, tx: string) => `7:${tx}`),
}));

vi.mock("../../src/deposit/lockup.ts", () => ({
    sponsoredCommitmentLock: vi.fn(async () => ({
        commitmentTxHash: "0xlock",
        commitmentLogIndex: 0,
        contract: "0x0000000000000000000000000000000000000001",
        claimAddress: "0x0000000000000000000000000000000000000002",
        timelock: 100,
    })),
}));

vi.mock("../../src/deposit/swapOut.ts", () => ({
    createOutSwap: vi.fn(async (args: { depositId: string }) => ({
        kind: "chain",
        swapId: "swap1",
        createdSwap: { id: "swap1" },
        preimage: "aa",
        preimageHash: "bb",
        claimPrivateKey: "cc",
        blindingKey: undefined,
        receiveAmountSats: 900,
        lockAmountSats: 990,
        quote: {
            depositId: args.depositId,
            swapId: "swap1",
            target: "chain",
            lockAmountSats: 990,
            receiveAsset: "L-BTC",
            receiveAmountSats: 900,
            bridgeFee: "10000",
        },
    })),
    claimChainOut: vi.fn(async () => "0xclaim"),
}));

vi.mock("../../src/deposit/refund.ts", () => ({
    sponsoredCommitmentRefund: vi.fn(async () => "0xrefund"),
}));

vi.mock("../../src/evm/commitment.ts", () => ({
    postCommitmentSignatureForTransaction: vi.fn(async () => undefined),
}));

vi.mock("../../src/evm/swapContracts.ts", () => ({
    buildSwapContractsForAsset: vi.fn(async () => ({
        erc20Swap: {},
        etherSwap: {},
    })),
}));

vi.mock("../../src/client.ts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/client.ts")>();
    return {
        ...actual,
        getSwapStatus: vi.fn(async () => ({
            status: "transaction.server.confirmed",
        })),
    };
});

const detected = (id = "0xdead:0"): DepositRecord => ({
    id,
    phase: DepositPhase.Detected,
    sourceAsset: "USDC-POL",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    index: 0,
    createdAt: 0,
    updatedAt: 0,
    amount: "1000000",
    txHash: "0xdead",
    logIndex: 0,
    blockNumber: 1,
});

type MakeDepsOpts = {
    resolveOut?: (ctx: never) => unknown;
    approveQuote?: (quote: never) => boolean | Promise<boolean>;
    pollIntervalMs?: number;
    mintTimeoutMs?: number;
    signal?: AbortSignal;
};

const makeDeps = (
    storage: DepositStorage,
    approve: boolean,
    opts: MakeDepsOpts = {},
) => {
    const events: DepositRecord[] = [];
    return {
        deps: {
            account: {} as never,
            storage,
            resolveOut:
                opts.resolveOut ??
                (() =>
                    ({
                        type: "chain",
                        to: "L-BTC",
                        address: "lq1...",
                    }) as never),
            approveQuote: opts.approveQuote ?? (() => approve),
            onEvent: (r: DepositRecord) => events.push({ ...r }),
            runExclusive: <T>(fn: () => Promise<T>) => fn(),
            pollIntervalMs: opts.pollIntervalMs,
            mintTimeoutMs: opts.mintTimeoutMs,
            signal: opts.signal,
        },
        events,
    };
};

describe("deposit engine state machine", () => {
    beforeEach(() => {
        setBoltzSwapsConfig(buildMainnetConfig());
    });
    afterEach(() => {
        clearCache();
        vi.clearAllMocks();
    });

    it("drives a fresh chain deposit from Detected to Done (lock-first)", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true);

        const final = await advanceDeposit(detected(), deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.claimTxId).toBe("0xclaim");
        expect(final.commitmentTxHash).toBe("0xlock");
        expect(final.bound).toBe(true);

        // Lock-first ordering: the commitment is locked before the swap exists.
        const phases = events.map((r) => r.phase);
        expect(phases.indexOf(DepositPhase.Locking)).toBeLessThan(
            phases.indexOf(DepositPhase.Creating),
        );
        expect(phases).toContain(DepositPhase.Binding);
        expect(phases).toContain(DepositPhase.Settling);

        expect(bridge.sponsoredCctpBurn).toHaveBeenCalledTimes(1);
        expect(swapOut.claimChainOut).toHaveBeenCalledTimes(1);
    });

    it("resumes from Locking without re-bridging", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        const record: DepositRecord = {
            ...detected(),
            phase: DepositPhase.Locking,
            burnTxHash: "0xburn",
            guid: "7:0xburn",
            mintedAmount: "990000",
        };

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(bridge.sponsoredCctpBurn).not.toHaveBeenCalled();
        expect(bridge.awaitCctpMint).not.toHaveBeenCalled();
    });

    it("refunds the unbound commitment when the quote is rejected", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, false);

        const final = await advanceDeposit(detected(), deps as never);

        expect(final.phase).toBe(DepositPhase.Failed);
        expect(final.refundTxHash).toBe("0xrefund");
        expect(refund.sponsoredCommitmentRefund).toHaveBeenCalledTimes(1);
        // Rejection happens after lock but before bind — commitment is unbound.
        expect(final.bound).toBeUndefined();
    });

    // --- Resume idempotency guards ---

    it("Binding resume with bound=true skips postCommitmentSignature", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        const record = {
            ...detected(),
            phase: DepositPhase.Binding,
            bound: true,
            swapId: "swap1",
            swapKind: "chain",
            commitmentTxHash: "0xlock",
            preimageHash: "bb",
            mintedAmount: "990000",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(
            commitment.postCommitmentSignatureForTransaction,
        ).not.toHaveBeenCalled();
    });

    it("Binding fresh (bound undefined) posts the commitment signature once", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        const record = {
            ...detected(),
            phase: DepositPhase.Binding,
            swapId: "swap1",
            swapKind: "chain",
            commitmentTxHash: "0xlock",
            preimageHash: "bb",
            mintedAmount: "990000",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.bound).toBe(true);
        expect(
            commitment.postCommitmentSignatureForTransaction,
        ).toHaveBeenCalledTimes(1);
    });

    it("Settling resume with claimTxId set skips settle and keeps the id", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        const record = {
            ...detected(),
            phase: DepositPhase.Settling,
            swapKind: "chain",
            swapId: "swap1",
            claimTxId: "0xEXISTING",
            bound: true,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.claimTxId).toBe("0xEXISTING");
        expect(swapOut.claimChainOut).not.toHaveBeenCalled();
        expect(vi.mocked(getSwapStatus)).not.toHaveBeenCalled();
    });

    it("Refunding resume with refundTxHash set skips a second refund", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, false);

        const record = {
            ...detected(),
            phase: DepositPhase.Refunding,
            commitmentTxHash: "0xlock",
            refundTxHash: "0xALREADY",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Failed);
        expect(final.refundTxHash).toBe("0xALREADY");
        expect(final.error).toBe("quote rejected — commitment refunded");
        expect(refund.sponsoredCommitmentRefund).not.toHaveBeenCalled();
    });

    // --- bridgeFee computation ---

    it("passes bridgeFee = amount - mintedAmount to createOutSwap", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        await advanceDeposit(detected(), deps as never);

        const mintedSats = Number(assetAmountToSats(990000n, "USDC"));
        expect(swapOut.createOutSwap).toHaveBeenCalledWith(
            expect.objectContaining({
                bridgeFee: 10000n,
                mintedSats,
                depositId: "0xdead:0",
            }),
        );
    });

    it("clamps a negative bridgeFee to 0n", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);
        vi.mocked(bridge.awaitCctpMint).mockResolvedValueOnce({
            mintedAmount: 1_100_000n,
        } as never);

        await advanceDeposit(detected(), deps as never);

        expect(swapOut.createOutSwap).toHaveBeenCalledWith(
            expect.objectContaining({ bridgeFee: 0n }),
        );
    });

    // --- Mint fallback + back-off ---

    it("falls back to manualMint when awaitCctpMint yields nothing", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);
        vi.mocked(bridge.awaitCctpMint).mockResolvedValueOnce(
            undefined as never,
        );
        vi.mocked(bridge.manualMint).mockResolvedValueOnce({
            mintTxHash: "0xmanual",
            mintedAmount: 990000n,
        } as never);

        const record = {
            ...detected(),
            phase: DepositPhase.AwaitingMint,
            guid: "7:0xburn",
            mintDeadline: 111,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(bridge.manualMint).toHaveBeenCalledTimes(1);
        expect(final.mintTxHash).toBe("0xmanual");
        expect(final.mintedAmount).toBe("990000");
        expect(final.phase).toBe(DepositPhase.Done);
    });

    it("AwaitingMint backs off then succeeds on the next cycle", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        // pollIntervalMs:0 makes sleep(0) resolve on the macrotask queue — no
        // fake timers needed.
        const { deps } = makeDeps(storage, true, { pollIntervalMs: 0 });
        vi.mocked(bridge.awaitCctpMint)
            .mockResolvedValueOnce(undefined as never)
            .mockResolvedValueOnce({ mintedAmount: 990000n } as never);
        vi.mocked(bridge.manualMint).mockResolvedValueOnce(undefined as never);

        const record = {
            ...detected(),
            phase: DepositPhase.AwaitingMint,
            guid: "7:0xburn",
            mintDeadline: Date.now() + 60_000,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(bridge.awaitCctpMint).toHaveBeenCalledTimes(2);
        expect(bridge.manualMint).toHaveBeenCalledTimes(1);
        expect(final.phase).toBe(DepositPhase.Done);
    });

    // --- settle() paths ---

    it("refunds the bound commitment when settle hits a failure status", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);
        vi.mocked(getSwapStatus).mockResolvedValueOnce({
            status: "invoice.failedToPay",
        } as never);

        const record = {
            ...detected(),
            phase: DepositPhase.Settling,
            swapKind: "submarine",
            swapId: "swap1",
            commitmentTxHash: "0xlock",
            bound: true,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        // Rather than throwing and wedging on every resume, a failed swap
        // cooperatively refunds the locked commitment and reaches a terminal
        // Failed phase carrying the failure cause.
        expect(final.phase).toBe(DepositPhase.Failed);
        expect(final.refundTxHash).toBe("0xrefund");
        expect(refund.sponsoredCommitmentRefund).toHaveBeenCalledTimes(1);
        expect(final.error).toMatch(/failed with status invoice\.failedToPay/);
    });

    it("fails a refundable error before any lock without refunding", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);
        vi.mocked(bridge.awaitCctpMint).mockRejectedValueOnce(
            new DepositRefundableError("mint impossible"),
        );

        const record = {
            ...detected(),
            phase: DepositPhase.AwaitingMint,
            guid: "7:0xburn",
            mintDeadline: Date.now() + 60_000,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        // No commitment locked yet → terminal Failed, no refund attempted.
        expect(final.phase).toBe(DepositPhase.Failed);
        expect(final.error).toBe("mint impossible");
        expect(refund.sponsoredCommitmentRefund).not.toHaveBeenCalled();
    });

    it("settles a submarine out with no claim tx", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);
        vi.mocked(getSwapStatus).mockResolvedValueOnce({
            status: "invoice.settled",
        } as never);

        const record = {
            ...detected(),
            phase: DepositPhase.Settling,
            swapKind: "submarine",
            swapId: "swap1",
            bound: true,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.claimTxId).toBeUndefined();
        expect(swapOut.claimChainOut).not.toHaveBeenCalled();
    });

    it("aborts inside the settle poll loop", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        // aborted is false for the outer-loop check and settle's first check,
        // then flips true so settle's second iteration throws.
        let reads = 0;
        const signal = {
            get aborted() {
                return reads++ >= 2;
            },
        } as unknown as AbortSignal;
        const { deps } = makeDeps(storage, true, {
            pollIntervalMs: 0,
            signal,
        });
        vi.mocked(getSwapStatus).mockResolvedValueOnce({
            status: "transaction.mempool",
        } as never);

        const record = {
            ...detected(),
            phase: DepositPhase.Settling,
            swapKind: "submarine",
            swapId: "swap1",
            bound: true,
        } as DepositRecord;

        await expect(advanceDeposit(record, deps as never)).rejects.toThrow(
            "aborted",
        );
    });

    // --- Bridging recovery branches ---

    it("Bridging resume with burnTxHash+guid goes straight to AwaitingMint", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true);

        const record = {
            ...detected(),
            phase: DepositPhase.Bridging,
            burnTxHash: "0xburn",
            guid: "7:0xburn",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(bridge.sponsoredCctpBurn).not.toHaveBeenCalled();
        expect(bridge.recoverBurn).not.toHaveBeenCalled();
        expect(events.map((r) => r.phase)).toContain(DepositPhase.AwaitingMint);
    });

    it("recovers a pending burn (Recovered) without re-burning", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true);
        vi.mocked(bridge.recoverBurn).mockResolvedValueOnce({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: "0xrecovered",
        });

        const record = {
            ...detected(),
            phase: DepositPhase.Bridging,
            pendingSend: pending as never,
            guid: "7:0xburn",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(bridge.sponsoredCctpBurn).not.toHaveBeenCalled();
        expect(events).toContainEqual(
            expect.objectContaining({
                phase: DepositPhase.AwaitingMint,
                burnTxHash: "0xrecovered",
            }),
        );
    });

    it("re-derives the guid from a recovered burn that lost it", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true);
        vi.mocked(bridge.recoverBurn).mockResolvedValueOnce({
            status: PendingBridgeSendRecoveryStatus.Recovered,
            transactionHash: "0xrecovered",
        });

        // The crash scenario: recovery yields only the tx hash, the record has
        // no guid. Without re-derivation AwaitingMint would poll with guid
        // undefined and crash in decodeCctpGuid on every resume.
        const record = {
            ...detected(),
            phase: DepositPhase.Bridging,
            pendingSend: pending as never,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(bridge.deriveCctpGuid).toHaveBeenCalledWith(
            "USDC-POL",
            "0xrecovered",
        );
        const awaitingMint = events.find(
            (r) => r.phase === DepositPhase.AwaitingMint,
        );
        expect(awaitingMint?.guid).toBe("7:0xrecovered");
        expect(vi.mocked(bridge.awaitCctpMint).mock.calls[0][0].guid).toBe(
            "7:0xrecovered",
        );
    });

    it("fails when a pending burn recovery reports Failed", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);
        vi.mocked(bridge.recoverBurn).mockResolvedValueOnce({
            status: PendingBridgeSendRecoveryStatus.Failed,
        });

        const record = {
            ...detected(),
            phase: DepositPhase.Bridging,
            pendingSend: pending as never,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Failed);
        expect(final.error).toBe("CCTP burn failed to broadcast");
        expect(bridge.sponsoredCctpBurn).not.toHaveBeenCalled();
    });

    it("re-checks a Pending burn recovery without double-burning", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true, { pollIntervalMs: 0 });
        vi.mocked(bridge.recoverBurn)
            .mockResolvedValueOnce({
                status: PendingBridgeSendRecoveryStatus.Pending,
            })
            .mockResolvedValueOnce({
                status: PendingBridgeSendRecoveryStatus.Recovered,
                transactionHash: "0xr",
            });

        const record = {
            ...detected(),
            phase: DepositPhase.Bridging,
            pendingSend: pending as never,
            guid: "7:0xburn",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(bridge.recoverBurn).toHaveBeenCalledTimes(2);
        expect(bridge.sponsoredCctpBurn).not.toHaveBeenCalled();
    });

    // --- Resume guards for Locking / Creating ---

    it("Locking resume with commitmentTxHash set skips the lock", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        const record = {
            ...detected(),
            phase: DepositPhase.Locking,
            commitmentTxHash: "0xlock",
            mintedAmount: "990000",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(lockup.sponsoredCommitmentLock).not.toHaveBeenCalled();
    });

    it("Creating resume with swapId set skips resolveOut/createOutSwap", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const resolveOut = vi.fn(() => ({
            type: "chain",
            to: "L-BTC",
            address: "lq1...",
        }));
        const { deps } = makeDeps(storage, true, {
            resolveOut: resolveOut as never,
        });

        const record = {
            ...detected(),
            phase: DepositPhase.Creating,
            mintedAmount: "990000",
            swapId: "swap1",
            swapKind: "chain",
            preimageHash: "bb",
            commitmentTxHash: "0xlock",
            quote: {
                depositId: "0xdead:0",
                swapId: "swap1",
                target: "chain",
                lockAmountSats: 990,
                receiveAsset: "L-BTC",
                receiveAmountSats: 900,
                bridgeFee: "10000",
            },
            target: { type: "chain", to: "L-BTC", address: "lq1..." },
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(swapOut.createOutSwap).not.toHaveBeenCalled();
        expect(resolveOut).not.toHaveBeenCalled();
    });

    // --- Context / persistence assertions on the fresh happy path ---

    it("mintDeadline is persisted once on resume (not recomputed)", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true);

        const record = {
            ...detected(),
            phase: DepositPhase.AwaitingMint,
            guid: "7:0xburn",
            mintDeadline: 111,
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(final.mintDeadline).toBe(111);
    });

    it("sets a fresh mintDeadline ~now+timeout when unset", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true, {
            mintTimeoutMs: 1000,
        });

        const before = Date.now();
        const record = {
            ...detected(),
            phase: DepositPhase.AwaitingMint,
            guid: "7:0xburn",
        } as DepositRecord;

        await advanceDeposit(record, deps as never);
        const after = Date.now();

        const withDeadline = events.find(
            (r) =>
                r.phase === DepositPhase.AwaitingMint &&
                r.mintDeadline !== undefined,
        );
        expect(withDeadline).toBeDefined();
        expect(withDeadline!.mintDeadline!).toBeGreaterThanOrEqual(
            before + 1000,
        );
        expect(withDeadline!.mintDeadline!).toBeLessThanOrEqual(after + 1000);
    });

    it("invokes resolveOut with the derived DepositResolveContext", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const resolveOut = vi.fn(() => ({
            type: "chain",
            to: "L-BTC",
            address: "lq1...",
        }));
        const { deps } = makeDeps(storage, true, {
            resolveOut: resolveOut as never,
        });

        await advanceDeposit(detected(), deps as never);

        const mintedSats = Number(assetAmountToSats(990000n, "USDC"));
        expect(resolveOut).toHaveBeenCalledTimes(1);
        expect(resolveOut).toHaveBeenCalledWith(
            expect.objectContaining({
                mintedAmount: 990000n,
                mintedSats,
                suggestedReceiveSats: mintedSats,
                deposit: expect.objectContaining({
                    id: "0xdead:0",
                    amount: 1000000n,
                }),
            }),
        );
    });

    it("checkpoints pendingSend at Bridging before the burn result", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true);

        await advanceDeposit(detected(), deps as never);

        const pendingIdx = events.findIndex(
            (r) =>
                r.phase === DepositPhase.Bridging &&
                r.pendingSend !== undefined,
        );
        const burnIdx = events.findIndex((r) => r.burnTxHash !== undefined);
        expect(pendingIdx).toBeGreaterThanOrEqual(0);
        expect(burnIdx).toBeGreaterThan(pendingIdx);
        expect(events[pendingIdx].pendingSend).toEqual(pending);
    });

    it("stores mintedAmount as a decimal string on the mint persist", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps, events } = makeDeps(storage, true);

        await advanceDeposit(detected(), deps as never);

        const lockingEvent = events.find(
            (r) => r.phase === DepositPhase.Locking,
        );
        expect(lockingEvent).toBeDefined();
        expect(typeof lockingEvent!.mintedAmount).toBe("string");
        expect(lockingEvent!.mintedAmount).toBe("990000");
    });

    it("calls approveQuote with the persisted quote", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const approveQuote = vi.fn(() => true);
        const { deps } = makeDeps(storage, true, {
            approveQuote: approveQuote as never,
        });

        await advanceDeposit(detected(), deps as never);

        expect(approveQuote).toHaveBeenCalledTimes(1);
        expect(approveQuote).toHaveBeenCalledWith(
            expect.objectContaining({
                swapId: "swap1",
                lockAmountSats: 990,
                bridgeFee: "10000",
            }),
        );
    });

    it("AwaitingApproval resume with approved=true skips re-prompting", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const approveQuote = vi.fn(() => true);
        const { deps } = makeDeps(storage, true, {
            approveQuote: approveQuote as never,
        });

        const record = {
            ...detected(),
            phase: DepositPhase.AwaitingApproval,
            approved: true,
            swapId: "swap1",
            swapKind: "chain",
            commitmentTxHash: "0xlock",
            preimageHash: "bb",
            mintedAmount: "990000",
        } as DepositRecord;

        const final = await advanceDeposit(record, deps as never);

        expect(final.phase).toBe(DepositPhase.Done);
        expect(approveQuote).not.toHaveBeenCalled();
    });

    it("aborts at the loop top before any work", async () => {
        const storage = createMemoryDepositStorage(EPHEMERAL);
        const { deps } = makeDeps(storage, true, {
            signal: { aborted: true } as AbortSignal,
        });

        await expect(advanceDeposit(detected(), deps as never)).rejects.toThrow(
            "aborted",
        );
        expect(bridge.sponsoredCctpBurn).not.toHaveBeenCalled();
    });
});
