import { getLogger } from "../logger.ts";
import { deriveDepositAccount } from "./derivation.ts";
import { getLatestBlock, scanIncomingTransfers } from "./detect.ts";
import { type EngineDeps, advanceDeposit } from "./engine.ts";
import {
    type CreateWatcherArgs,
    DEPOSIT_CONFIRMATIONS,
    DEPOSIT_SOURCE_ASSETS,
    DepositPhase,
    type DepositRecord,
    type DepositSourceAsset,
    type DepositWatcher,
    encodeDepositId,
} from "./types.ts";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const defaultPollIntervalMs = 15_000;

// Serialize all sponsored sends for one derived address (7702 nonce races).
const createMutex = () => {
    let tail: Promise<unknown> = Promise.resolve();
    return <T>(fn: () => Promise<T>): Promise<T> => {
        const run = tail.then(fn, fn);
        tail = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    };
};

const runWatcher = async (
    args: CreateWatcherArgs,
    resume: boolean,
): Promise<DepositWatcher> => {
    const log = getLogger();
    const index = args.index ?? 0;
    const account = deriveDepositAccount(args.mnemonic, index);
    const address = account.address;
    const sourceAssets: DepositSourceAsset[] = args.sourceAssets ?? [
        ...DEPOSIT_SOURCE_ASSETS,
    ];
    const pollIntervalMs = args.pollIntervalMs ?? defaultPollIntervalMs;
    const confirmations = (asset: DepositSourceAsset): number =>
        args.confirmations?.[asset] ?? DEPOSIT_CONFIRMATIONS[asset] ?? 0;

    const controller = new AbortController();
    const stop = () => controller.abort();
    if (args.signal !== undefined) {
        if (args.signal.aborted) {
            controller.abort();
        } else {
            args.signal.addEventListener("abort", stop, { once: true });
        }
    }
    const signal = controller.signal;

    const deps: EngineDeps = {
        account,
        storage: args.storage,
        resolveOut: args.resolveOut,
        approveQuote: args.approveQuote,
        onEvent: args.onEvent,
        pollIntervalMs: args.pollIntervalMs,
        signal,
        runExclusive: createMutex(),
    };

    const running = new Set<string>();
    const spawn = (record: DepositRecord): void => {
        if (running.has(record.id)) {
            return;
        }
        running.add(record.id);
        void advanceDeposit(record, deps)
            .catch((error) => {
                log.error("Deposit engine error", { id: record.id, error });
                args.onError?.(error);
            })
            .finally(() => running.delete(record.id));
    };

    // (Re)spawn every in-flight deposit this watcher owns. Only records for our
    // own derivation index are driven — resuming another index's record would
    // sign its burn/lock with the wrong account. Idempotent via the `running`
    // set, so re-running it retries any deposit whose engine dropped out on a
    // transient error without re-spawning ones already in flight.
    const reconcile = async (): Promise<void> => {
        const active = await args.storage.listActiveDeposits();
        for (const record of active) {
            if (record.index === index) {
                spawn(record);
            }
        }
    };

    // Resume in-flight deposits before scanning so the scan loop dedups against
    // their existing records, then keep reconciling so a transient engine error
    // does not strand a deposit until the next process restart.
    if (resume) {
        await reconcile();
        void (async () => {
            while (!signal.aborted) {
                await sleep(pollIntervalMs);
                if (signal.aborted) {
                    break;
                }
                try {
                    await reconcile();
                } catch (error) {
                    log.warn("Deposit reconcile error", { error });
                    args.onError?.(error);
                }
            }
        })();
    }

    const scanLoop = async (sourceAsset: DepositSourceAsset): Promise<void> => {
        while (!signal.aborted) {
            try {
                const latest = await getLatestBlock(sourceAsset);
                // Only act on transfers buried by the confirmation depth: a
                // reorged-out transfer at the tip must never drive a sponsored
                // (irreversible) CCTP burn.
                const confirmed = latest - confirmations(sourceAsset);
                const watermark = await args.storage.getWatermark(sourceAsset);
                const from =
                    watermark ?? args.startBlocks?.[sourceAsset] ?? confirmed; // fresh address: start at the confirmed tip

                if (confirmed >= from) {
                    const transfers = await scanIncomingTransfers({
                        sourceAsset,
                        address,
                        fromBlock: from,
                        toBlock: confirmed,
                    });
                    for (const transfer of transfers) {
                        const id = encodeDepositId(
                            sourceAsset,
                            transfer.txHash,
                            transfer.logIndex,
                        );
                        if ((await args.storage.getDeposit(id)) !== undefined) {
                            continue;
                        }
                        const now = Date.now();
                        const record: DepositRecord = {
                            id,
                            phase: DepositPhase.Detected,
                            sourceAsset,
                            address,
                            index,
                            createdAt: now,
                            updatedAt: now,
                            amount: transfer.amount.toString(),
                            txHash: transfer.txHash,
                            logIndex: transfer.logIndex,
                            blockNumber: transfer.blockNumber,
                        };
                        await args.storage.putDeposit(record);
                        args.onEvent?.(record);
                        spawn(record);
                    }
                    await args.storage.setWatermark(sourceAsset, confirmed);
                }
            } catch (error) {
                log.warn("Deposit scan error", { sourceAsset, error });
                args.onError?.(error);
            }
            await sleep(pollIntervalMs);
        }
    };

    for (const sourceAsset of sourceAssets) {
        void scanLoop(sourceAsset);
    }

    log.info("Deposit watcher started", {
        address,
        index,
        sourceAssets,
        resume,
    });

    return { address, index, stop };
};

export const createWatcher = (
    args: CreateWatcherArgs,
): Promise<DepositWatcher> => runWatcher(args, false);

export const resumeWatcher = (
    args: CreateWatcherArgs,
): Promise<DepositWatcher> => runWatcher(args, true);
