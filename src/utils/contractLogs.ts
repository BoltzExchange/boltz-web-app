import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { BytesLike, Result, Signer } from "ethers";
import { Contract, JsonRpcProvider } from "ethers";
import log from "loglevel";

import { config } from "../config";
import type { AssetType } from "../consts/Assets";
import { RBTC } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { EtherSwapAbi } from "../context/Web3";
import {
    PreimageHashesWorker,
    type PreimageMap,
} from "../workers/preimageHashes/PreimageHashesWorker";
import { weiToSatoshi } from "./rootstock";

const scanInterval = 2_000;
const parallelBatchSize = 5;

type LockupEvent = {
    data: BytesLike;
    blockNumber: number;
    transactionHash: string;
    topics: readonly string[];
};

type BlockRange = { fromBlock: number; toBlock: number };

export type LogRefundData = {
    asset: AssetType;
    blockNumber: number;
    transactionHash: string;

    preimageHash: string;
    preimage?: string;
    amount: bigint;
    claimAddress: string;
    refundAddress: string;
    timelock: bigint;
};

type ScanFilter = {
    address: string;
};

type ScanConfig = {
    filter?: ScanFilter;
    action?: RskRescueMode;
    mnemonic?: string;
};

type ScanResult = {
    progress: number;
    events: LogRefundData[];
    derivedKeys?: number;
};

type ScanContext = {
    providerUrl: string;
    contractAddress: string;
    latestBlock: number;
    minBlock: number;
    contract: EtherSwap;
    filter: ReturnType<EtherSwap["filters"]["Lockup"]>;
    totalBlocks: number;
};

/**
 * Reconciles pending claims against the current preimage map.
 * Returns matched claims removed from the pending list.
 */
const reconcilePendingClaims = (
    pendingClaims: LogRefundData[],
    preimageMap: PreimageMap,
): LogRefundData[] => {
    const matched: LogRefundData[] = [];

    for (let i = pendingClaims.length - 1; i >= 0; i--) {
        const entry = preimageMap.get(pendingClaims[i].preimageHash);
        if (entry) {
            pendingClaims[i].preimage = entry.preimage;
            matched.push(pendingClaims[i]);
            pendingClaims.splice(i, 1);
        }
    }

    return matched;
};

const createScanContext = async (
    etherSwap: EtherSwap,
): Promise<ScanContext | null> => {
    const providerUrl = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (providerUrl === undefined) {
        return null;
    }

    const contractAddress = await etherSwap.getAddress();
    const provider = new JsonRpcProvider(providerUrl);
    const latestBlock = await provider.getBlockNumber();
    const minBlock = config.assets[RBTC].contracts.deployHeight;

    const contract = new Contract(
        contractAddress,
        EtherSwapAbi,
        provider,
    ) as unknown as EtherSwap;

    return {
        providerUrl,
        contractAddress,
        latestBlock,
        minBlock,
        contract,
        filter: contract.filters.Lockup(),
        totalBlocks: latestBlock - minBlock,
    };
};

/**
 * Generates block ranges for scanning, from latest block down to min block.
 * Yields batches of ranges that can be fetched in parallel.
 */
function* generateBlockRangeBatches(
    latestBlock: number,
    minBlock: number,
    intervalSize = scanInterval,
    batchSize = parallelBatchSize,
): Generator<BlockRange[]> {
    for (
        let batchEnd = latestBlock;
        batchEnd >= minBlock;
        batchEnd -= intervalSize * batchSize
    ) {
        const ranges: BlockRange[] = [];

        for (let i = 0; i < batchSize; i++) {
            const toBlock = batchEnd - i * intervalSize;
            if (toBlock < minBlock) {
                break;
            }

            const fromBlock = Math.max(toBlock - intervalSize + 1, minBlock);
            ranges.push({ fromBlock, toBlock });
        }

        if (ranges.length > 0) {
            yield ranges;
        }
    }
}

/**
 * Fetches events for multiple block ranges in parallel.
 * Returns events sorted by block number descending (most recent first).
 */
const fetchEventsForRanges = async (
    ranges: BlockRange[],
    contractAddress: string,
    providerUrl: string,
    filter: ReturnType<EtherSwap["filters"]["Lockup"]>,
): Promise<LockupEvent[]> => {
    const results = await Promise.all(
        ranges.map(({ fromBlock, toBlock }) =>
            (
                new Contract(
                    contractAddress,
                    EtherSwapAbi,
                    new JsonRpcProvider(providerUrl),
                ) as unknown as EtherSwap
            ).queryFilter(filter, fromBlock, toBlock),
        ),
    );

    return results.flat().sort((a, b) => b.blockNumber - a.blockNumber);
};

const parseLockupEvent = (
    etherSwap: EtherSwap,
    event: {
        data: BytesLike;
        blockNumber: number;
        transactionHash: string;
        topics: readonly string[];
    },
): {
    data: LogRefundData;
    decoded: Result;
} => {
    const decoded = etherSwap.interface.decodeEventLog(
        etherSwap.interface.getEvent("Lockup"),
        event.data,
        event.topics,
    );
    return {
        decoded,
        data: {
            asset: RBTC,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            preimageHash: decoded[0].substring(2),
            amount: weiToSatoshi(decoded[1]),
            claimAddress: decoded[2],
            refundAddress: decoded[3],
            timelock: decoded[4],
        },
    };
};

const matchesFilter = (
    data: LogRefundData,
    filter?: ScanFilter,
): RskRescueMode | null => {
    if (!filter) {
        return null;
    }

    const refundAddr = data.refundAddress.toLowerCase();
    const claimAddr = data.claimAddress.toLowerCase();

    if (filter.address) {
        const walletAddress = filter.address.toLowerCase();
        if (claimAddr === walletAddress) {
            return RskRescueMode.Claim;
        }
        if (refundAddr === walletAddress) {
            return RskRescueMode.Refund;
        }
    }

    return null;
};

export const getLogsFromReceipt = async (
    signer: Signer,
    etherSwap: EtherSwap,
    txHash: string,
): Promise<LogRefundData> => {
    const receipt = await signer.provider.getTransactionReceipt(txHash);

    if (receipt === null) {
        throw new Error(`Transaction receipt not found for ${txHash}`);
    }

    for (const event of receipt.logs) {
        if (
            event.topics[0] !== etherSwap.interface.getEvent("Lockup").topicHash
        ) {
            continue;
        }

        return parseLockupEvent(etherSwap, event).data;
    }

    throw new Error(`Lockup event not found in transaction ${txHash}`);
};

/**
 * Unified generator for scanning lockup events with configurable filtering.
 * Yields progress and events for each batch of blocks scanned.
 */
export async function* scanLockupEvents(
    abortSignal: AbortSignal,
    etherSwap: EtherSwap,
    scanConfig: ScanConfig = {},
): AsyncGenerator<ScanResult> {
    const ctx = await createScanContext(etherSwap);
    if (ctx === null) {
        return;
    }

    const needsPreimages =
        scanConfig.action === RskRescueMode.Claim && scanConfig.mnemonic;
    const worker = needsPreimages ? new PreimageHashesWorker() : null;
    if (worker) {
        log.info("Starting preimage derivation in background");
        worker.start(scanConfig.mnemonic, abortSignal);
    }

    let blocksScanned = 0;
    const pendingClaims: LogRefundData[] = [];

    for (const ranges of generateBlockRangeBatches(
        ctx.latestBlock,
        ctx.minBlock,
    )) {
        if (abortSignal.aborted) {
            log.info(`Cancelling lockup event scan`);
            worker?.terminate();
            return;
        }

        log.debug(
            `Scanning blocks ${ranges[ranges.length - 1].fromBlock} to ${ranges[0].toBlock}`,
        );
        const events = await fetchEventsForRanges(
            ranges,
            ctx.contractAddress,
            ctx.providerUrl,
            ctx.filter,
        );

        blocksScanned += ranges.length * scanInterval;
        const results: ScanResult = {
            progress: Math.min(blocksScanned / ctx.totalBlocks, 1),
            events: [],
            derivedKeys: worker?.map.size,
        };

        for (const event of events) {
            const { data, decoded } = parseLockupEvent(etherSwap, event);
            const match = matchesFilter(data, scanConfig.filter);

            if (match === null || match !== scanConfig.action) {
                continue;
            }

            log.debug(
                `Found relevant lockup event in: ${event.transactionHash}`,
            );

            const swapHash = await ctx.contract.hashValues(
                decoded[0],
                decoded[1],
                data.claimAddress,
                data.refundAddress,
                data.timelock,
            );
            const stillLocked = await ctx.contract.swaps(swapHash);

            if (!stillLocked) {
                log.info(
                    `Lockup event in ${event.transactionHash} already spent`,
                );
                continue;
            }

            log.info(`Found rescuable swap in: ${event.transactionHash}`);

            switch (match) {
                case RskRescueMode.Refund: {
                    results.events.push(data);
                    break;
                }

                case RskRescueMode.Claim: {
                    pendingClaims.push(data);
                    break;
                }
            }
        }

        if (worker) {
            results.events.push(
                ...reconcilePendingClaims(pendingClaims, worker.map),
            );
            results.derivedKeys = worker.map.size;
        }

        yield results;
    }

    if (worker) {
        log.info(
            `Deriving preimages for ${pendingClaims.length} pending claims`,
        );
        while (pendingClaims.length > 0 && !worker.isDone) {
            await worker.waitForNextBatch();
            const matched = reconcilePendingClaims(pendingClaims, worker.map);
            yield {
                progress: 1,
                events: matched,
                derivedKeys: worker.map.size,
            };
        }
    }

    worker?.terminate();
    log.info(`Finished lockup event scanning`);
}
