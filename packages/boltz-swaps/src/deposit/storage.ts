import type { KeyValueStore } from "../storage/index.ts";
import {
    type DepositRecord,
    type DepositStorage,
    isTerminalPhase,
} from "./types.ts";

const WATERMARK_PREFIX = "watermark.";
const DEPOSIT_PREFIX = "deposit.";

// Adapt any generic `KeyValueStore` into the deposit-specific `DepositStorage`
// facade the watcher/engine consume.
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
