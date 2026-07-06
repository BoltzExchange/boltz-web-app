import {
    type KeyValueStore,
    MemoryKeyValueStore,
    type MemoryKeyValueStoreOptions,
} from "../storage/index.ts";
import {
    type DepositRecord,
    type DepositStorage,
    isTerminalPhase,
} from "./types.ts";

// Watermarks and deposit records share one KeyValueStore under distinct key
// prefixes.
const WATERMARK_PREFIX = "watermark.";
const DEPOSIT_PREFIX = "deposit.";

// Adapt any generic `KeyValueStore` into the deposit-specific `DepositStorage`
// facade the watcher/engine consume. Back it with `MemoryKeyValueStore` (tests,
// ephemeral) or, in the browser, `LocalStorageKeyValueStore` (durable resume):
//
//   createDepositStorage(new LocalStorageKeyValueStore({ prefix: "boltz.deposit." }))
export const createDepositStorage = (kv: KeyValueStore): DepositStorage => ({
    getWatermark: (sourceAsset) =>
        kv.get<number>(WATERMARK_PREFIX + sourceAsset),
    setWatermark: (sourceAsset, block) =>
        kv.set(WATERMARK_PREFIX + sourceAsset, block),
    putDeposit: (record) => kv.set(DEPOSIT_PREFIX + record.id, record),
    getDeposit: (id) => kv.get<DepositRecord>(DEPOSIT_PREFIX + id),
    listActiveDeposits: async () =>
        (await kv.entries<DepositRecord>(DEPOSIT_PREFIX))
            .map(([, record]) => record)
            .filter((record) => !isTerminalPhase(record.phase)),
});

// In-memory deposit store for tests, examples, and single-process ephemeral
// use. State is lost on restart, so the watcher cannot resume in-flight
// deposits — hence the required `inMemoryStorageShouldNeverBeUsedInProduction`
// acknowledgment. Production consumers must back `createDepositStorage` with a
// durable `KeyValueStore` (e.g. `LocalStorageKeyValueStore`).
export const createMemoryDepositStorage = (
    options: MemoryKeyValueStoreOptions,
): DepositStorage => createDepositStorage(new MemoryKeyValueStore(options));
