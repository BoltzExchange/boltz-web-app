import { PendingBridgeSendKind } from "boltz-swaps/bridge";
import {
    LocalStorageKeyValueStore,
    MemoryKeyValueStore,
} from "boltz-swaps/storage";
import { describe, expect, it } from "vitest";

import { createDepositStorage } from "../../src/deposit/storage.ts";
import {
    DepositPhase,
    type DepositRecord,
    type DepositSourceAsset,
    encodeDepositId,
} from "../../src/deposit/types.ts";
import { createMapStorage } from "../../src/storage/memory.ts";

const memoryStorage = () =>
    createDepositStorage(
        new MemoryKeyValueStore({
            inMemoryStorageShouldNeverBeUsedInProduction: true,
        }),
    );

const record = (
    id: string,
    phase: DepositPhase,
    sourceAsset: DepositSourceAsset = "USDC-POL",
): DepositRecord => ({
    id,
    phase,
    sourceAsset,
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    index: 0,
    createdAt: 0,
    updatedAt: 0,
    amount: "1000000",
    txHash: `0x${id}`,
    logIndex: 0,
    blockNumber: 1,
});

describe("createDepositStorage over an in-memory KeyValueStore", () => {
    it("stores and returns watermarks per source asset", async () => {
        const storage = memoryStorage();
        expect(await storage.getWatermark("USDC-POL")).toBeUndefined();
        await storage.setWatermark("USDC-POL", 123);
        await storage.setWatermark("USDC-BASE", 456);
        expect(await storage.getWatermark("USDC-POL")).toBe(123);
        expect(await storage.getWatermark("USDC-BASE")).toBe(456);
    });

    it("upserts and returns deposits by id", async () => {
        const storage = memoryStorage();
        expect(await storage.getDeposit("a")).toBeUndefined();
        await storage.putDeposit(record("a", DepositPhase.Detected));
        await storage.putDeposit(record("a", DepositPhase.Bridging));
        const got = await storage.getDeposit("a");
        expect(got?.phase).toBe(DepositPhase.Bridging);
    });

    it("keeps identical transaction coordinates from different source chains", async () => {
        const storage = memoryStorage();
        const coordinates = { txHash: "0xabc", logIndex: 0 };
        const polygonId = encodeDepositId(
            "USDC-POL",
            coordinates.txHash,
            coordinates.logIndex,
        );
        const baseId = encodeDepositId(
            "USDC-BASE",
            coordinates.txHash,
            coordinates.logIndex,
        );

        await storage.putDeposit({
            ...record(polygonId, DepositPhase.Detected, "USDC-POL"),
            ...coordinates,
        });
        await storage.putDeposit({
            ...record(baseId, DepositPhase.Detected, "USDC-BASE"),
            ...coordinates,
        });

        expect((await storage.getDeposit(polygonId))?.sourceAsset).toBe(
            "USDC-POL",
        );
        expect((await storage.getDeposit(baseId))?.sourceAsset).toBe(
            "USDC-BASE",
        );
        expect(await storage.listActiveDeposits()).toHaveLength(2);
    });

    it("returns a defensive copy (no shared identity with the store)", async () => {
        const storage = memoryStorage();
        const original = record("a", DepositPhase.Detected);
        await storage.putDeposit(original);
        original.phase = DepositPhase.Failed;
        expect((await storage.getDeposit("a"))?.phase).toBe(
            DepositPhase.Detected,
        );
    });

    it("lists only non-terminal (active) deposits", async () => {
        const storage = memoryStorage();
        await storage.putDeposit(record("active", DepositPhase.Locking));
        await storage.putDeposit(record("done", DepositPhase.Done));
        await storage.putDeposit(record("failed", DepositPhase.Failed));
        const active = await storage.listActiveDeposits();
        expect(active.map((r) => r.id)).toEqual(["active"]);
    });

    // Every non-terminal phase must resume; Refunding is the load-bearing case
    // (a restarted watcher must re-spawn in-flight refunds).
    it("keeps every non-terminal phase active and drops only Done/Failed", async () => {
        const storage = memoryStorage();
        for (const p of Object.values(DepositPhase)) {
            await storage.putDeposit(record(p, p));
        }
        const active = (await storage.listActiveDeposits())
            .map((r) => r.id)
            .sort();
        expect(active).toEqual(
            [
                DepositPhase.Detected,
                DepositPhase.Bridging,
                DepositPhase.AwaitingMint,
                DepositPhase.Locking,
                DepositPhase.Creating,
                DepositPhase.AwaitingApproval,
                DepositPhase.Binding,
                DepositPhase.Settling,
                DepositPhase.Refunding,
            ].sort(),
        );
        expect(active).toContain(DepositPhase.Refunding);
        expect(active).not.toContain(DepositPhase.Done);
        expect(active).not.toContain(DepositPhase.Failed);
    });
});

describe("createDepositStorage over a persistent KeyValueStore", () => {
    it("round-trips records + watermarks through localStorage-backed storage", async () => {
        const kv = new LocalStorageKeyValueStore({
            storage: createMapStorage(),
            prefix: "boltz.deposit.",
        });
        const storage = createDepositStorage(kv);

        await storage.setWatermark("USDC-POL", 0); // stored 0 must survive
        await storage.putDeposit(record("active", DepositPhase.Locking));
        await storage.putDeposit(record("done", DepositPhase.Done));

        expect(await storage.getWatermark("USDC-POL")).toBe(0);
        expect((await storage.getDeposit("active"))?.phase).toBe(
            DepositPhase.Locking,
        );
        const active = await storage.listActiveDeposits();
        expect(active.map((r) => r.id)).toEqual(["active"]);
    });

    // A poisoned record in the middle must not abort the resume enumeration:
    // survivors are returned and the bad id reads back as absent.
    it("skips a corrupt record in the middle and returns the survivors", async () => {
        const raw = createMapStorage();
        const kv = new LocalStorageKeyValueStore({
            storage: raw,
            prefix: "boltz.",
        });
        const storage = createDepositStorage(kv);
        await storage.putDeposit(record("a", DepositPhase.Locking));
        await storage.putDeposit(record("b", DepositPhase.Creating));
        await storage.putDeposit(record("c", DepositPhase.Settling));
        // Physical key = `${prefix.length}:${prefix}` + DEPOSIT_PREFIX + id.
        raw.setItem("6:boltz.deposit.b", "{corrupt");

        expect(
            (await storage.listActiveDeposits()).map((r) => r.id).sort(),
        ).toEqual(["a", "c"]);
        expect(await storage.getDeposit("b")).toBeUndefined();
        expect((await storage.getDeposit("a"))?.phase).toBe(
            DepositPhase.Locking,
        );
    });

    it("round-trips a fully-populated DepositRecord through JSON", async () => {
        const full: DepositRecord = {
            ...record("a", DepositPhase.Binding),
            burnTxHash: "0xburn",
            guid: "g",
            cctpNonce: "1",
            cctpMessage: "0xmsg",
            pendingSend: {
                kind: PendingBridgeSendKind.EvmCctp,
                createdAt: 1,
                sender: "0xabc",
                fromNonce: 2,
                fromBlock: 3,
                tokenMessenger: "0xtm",
                messageTransmitter: "0xmt",
                calldata: "0xdead",
            },
            mintDeadline: 42,
            mintTxHash: "0xmint",
            mintedAmount: "999999",
            commitmentTxHash: "0xcommit",
            commitmentLogIndex: 7,
            target: { type: "lightning", destination: "user@ln.tld" },
            swapId: "s",
            swapKind: "submarine",
            preimage: "0xpre",
            preimageHash: "0xph",
            claimPrivateKey: "0xkey",
            blindingKey: "0xblind",
            receiveAmountSats: 950,
            quote: {
                depositId: "a",
                swapId: "s",
                target: "lightning",
                lockAmountSats: 1000,
                receiveAsset: "BTC",
                receiveAmountSats: 950,
                bridgeFee: "500",
            },
            bound: true,
            claimTxId: "0xclaim",
            refundTxHash: "0xrefund",
            error: "none",
        };
        const kv = new LocalStorageKeyValueStore({
            storage: createMapStorage(),
            prefix: "boltz.deposit.",
        });
        const storage = createDepositStorage(kv);
        await storage.putDeposit(full);
        expect(await storage.getDeposit("a")).toEqual(full);
    });
});
