import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { BytesLike, Result, Signer } from "ethers";
import { Contract, JsonRpcProvider } from "ethers";
import log from "loglevel";
import { RskRescueMode } from "src/pages/RescueExternal";

import { config } from "../config";
import type { AssetType } from "../consts/Assets";
import { RBTC } from "../consts/Assets";
import { EtherSwapAbi } from "../context/Web3";
import { PreimageHashesWorker } from "../workers/preimageHashes/PreimageHashesWorker";
import { weiToSatoshi } from "./rootstock";

/**
 * Why does it work fine when I have RBTC as the receiveAsset but does not work when it is the sendAsset?
 * That is, it only works when the claimAddress is the one I'm looking for, but is currently not working with the RefundAddress
 *
 * After I create a RBTC -> BTC swap and claim BTC, I can't easily get the highest index on an incognito browser. Why?
 */

const scanInterval = 2_000;
const parallelBatchSize = 5;

type LockupEvent = {
    data: BytesLike;
    blockNumber: number;
    transactionHash: string;
    topics: readonly string[];
};

type BlockRange = { fromBlock: number; toBlock: number };

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
            if (toBlock < minBlock) break;

            const fromBlock = Math.max(toBlock - intervalSize, minBlock);
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

// Unified scan configuration types
type ScanFilter = {
    address?: string; // Filter by refund OR claim address
    refundAddress?: string; // Filter by refund address only
    claimAddress?: string; // Filter by claim address only
};

type ScanConfig = {
    filter?: ScanFilter;
    maxBlocks?: number; // Limit scan depth (default: full scan)
    action?: RskRescueMode; // Action to perform (refund or claim)
    mnemonic?: string; // Mnemonic for preimage derivation (only used for claim action)
};

type ScanResult = {
    progress: number; // 0-1 progress
    events: LogRefundData[];
};

export const getLogsFromReceipt = async (
    signer: Signer,
    etherSwap: EtherSwap,
    txHash: string,
): Promise<LogRefundData> => {
    const receipt = await signer.provider.getTransactionReceipt(txHash);

    for (const event of receipt.logs) {
        if (
            event.topics[0] !== etherSwap.interface.getEvent("Lockup").topicHash
        ) {
            continue;
        }

        return parseLockupEvent(etherSwap, event).data;
    }

    throw "could not find event";
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

const matchesFilter = (data: LogRefundData, filter?: ScanFilter) => {
    if (!filter)
        return { isRefundable: false, isClaimable: false, matches: false };

    const refundAddr = data.refundAddress.toLowerCase();
    const claimAddr = data.claimAddress.toLowerCase();

    // Filter by specific refund address only
    if (filter.refundAddress) {
        const isRefundable = refundAddr === filter.refundAddress.toLowerCase();
        return { isRefundable, isClaimable: false, matches: isRefundable };
    }

    // Filter by specific claim address only
    if (filter.claimAddress) {
        const isClaimable = claimAddr === filter.claimAddress.toLowerCase();
        return { isRefundable: false, isClaimable, matches: isClaimable };
    }

    // Filter by either refund OR claim address
    if (filter.address) {
        const normalizedAddress = filter.address.toLowerCase();
        const isRefundable = refundAddr === normalizedAddress;
        const isClaimable = claimAddr === normalizedAddress;
        return {
            isRefundable,
            isClaimable,
            matches: isRefundable || isClaimable,
        };
    }

    return { isRefundable: false, isClaimable: false, matches: false };
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
    const scanProviderUrl = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (scanProviderUrl === undefined) {
        return;
    }

    const contractAddress = await etherSwap.getAddress();
    const latestBlock = await new JsonRpcProvider(
        scanProviderUrl,
    ).getBlockNumber();
    const deployHeight = config.assets[RBTC].contracts.deployHeight;
    const minBlock = scanConfig.maxBlocks
        ? Math.max(latestBlock - scanConfig.maxBlocks, deployHeight)
        : deployHeight;

    const etherSwapScan = new Contract(
        contractAddress,
        EtherSwapAbi,
        new JsonRpcProvider(scanProviderUrl),
    ) as unknown as EtherSwap;
    const filter = etherSwapScan.filters.Lockup();

    let blocksScanned = 0;
    const totalBlocks = latestBlock - minBlock;
    let preimageMap: Map<string, string> = new Map();

    for (const ranges of generateBlockRangeBatches(latestBlock, minBlock)) {
        if (abortSignal.aborted) {
            log.info(`Cancelling lockup event scan`);
            return;
        }

        log.debug(
            `Scanning blocks ${ranges[ranges.length - 1].fromBlock} to ${ranges[0].toBlock}`,
        );
        const events = await fetchEventsForRanges(
            ranges,
            contractAddress,
            scanProviderUrl,
            filter,
        );

        blocksScanned += ranges.length * scanInterval;
        const results: ScanResult = {
            progress: Math.min(blocksScanned / totalBlocks, 1),
            events: [],
        };

        for (const event of events) {
            const { data, decoded } = parseLockupEvent(etherSwap, event);
            const { isRefundable, isClaimable, matches } = matchesFilter(
                data,
                scanConfig.filter,
            );

            if (!matches) continue;

            log.debug(
                `Found relevant lockup event in: ${event.transactionHash}`,
            );

            if (isRefundable && scanConfig.action === RskRescueMode.Refund) {
                results.events.push(data);
                continue;
            }

            if (isClaimable && scanConfig.action === RskRescueMode.Claim) {
                const swapHash = await etherSwapScan.hashValues(
                    decoded[0],
                    decoded[1],
                    data.claimAddress,
                    data.refundAddress,
                    data.timelock,
                );
                const stillLocked = await etherSwapScan.swaps(swapHash);

                if (!stillLocked) {
                    log.info(
                        `Lockup event in ${event.transactionHash} already spent`,
                    );
                    continue;
                }

                log.info(
                    `Found rescuable swap in: ${event.transactionHash} (refundable: ${isRefundable}, claimable: ${isClaimable})`,
                );

                if (preimageMap.size === 0) {
                    preimageMap = await new PreimageHashesWorker().deriveHashes(
                        scanConfig.mnemonic,
                        data.preimageHash,
                    );
                    if (abortSignal.aborted) {
                        return;
                    }
                    log.debug(
                        `Derived ${preimageMap.size} preimage hashes for this address`,
                    );
                }
                data.preimage = preimageMap.get(data.preimageHash);

                if (data.preimage !== undefined) {
                    results.events.push(data);
                }
            }
        }

        yield results;
    }

    log.info(`Finished lockup event scanning`);
}

const MAX_BLOCKS_FOR_INDEX_SCAN = 100_000;

/**
 * Generator that scans for the highest preimage index used by an address.
 * Yields { progress } during scan, returns the final preimage index number.
 * Scans at most 100k blocks and stops at the first relevant match.
 */
export async function* preimagesGenerator(
    abortSignal: AbortSignal,
    signerAddress: string,
    mnemonic: string,
    etherSwap: EtherSwap,
): AsyncGenerator<{ progress: number }, number> {
    const scanProviderUrl = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (scanProviderUrl === undefined) {
        log.warn("VITE_RSK_LOG_SCAN_ENDPOINT not set, skipping preimage scan");
        return -1;
    }

    if (!mnemonic) {
        log.warn("No mnemonic provided, skipping preimage scan");
        return -1;
    }

    const contractAddress = await etherSwap.getAddress();
    const latestBlock = await new JsonRpcProvider(
        scanProviderUrl,
    ).getBlockNumber();
    const deployHeight = config.assets[RBTC].contracts.deployHeight;
    const minBlock = Math.max(
        latestBlock - MAX_BLOCKS_FOR_INDEX_SCAN,
        deployHeight,
    );

    const etherSwapScan = new Contract(
        contractAddress,
        EtherSwapAbi,
        new JsonRpcProvider(scanProviderUrl),
    ) as unknown as EtherSwap;
    const filter = etherSwapScan.filters.Lockup();

    let blocksScanned = 0;
    const totalBlocks = latestBlock - minBlock;

    for (const ranges of generateBlockRangeBatches(latestBlock, minBlock)) {
        if (abortSignal.aborted) {
            log.info(`Cancelling lockup event scan`);
            return -1;
        }

        log.debug(
            `Scanning blocks ${ranges[ranges.length - 1].fromBlock} to ${ranges[0].toBlock}`,
        );
        const events = await fetchEventsForRanges(
            ranges,
            contractAddress,
            scanProviderUrl,
            filter,
        );

        blocksScanned += ranges.length * scanInterval;
        yield { progress: Math.min(blocksScanned / totalBlocks, 1) };

        for (const event of events) {
            const { data } = parseLockupEvent(etherSwap, event);
            const { isRefundable, isClaimable, matches } = matchesFilter(data, {
                address: signerAddress,
            });
            if (!matches) continue;

            log.debug(
                `Found relevant lockup event in block ${data.blockNumber}: ${data.transactionHash} (refundable: ${isRefundable}, claimable: ${isClaimable})`,
            );

            const preimageMap = await new PreimageHashesWorker().deriveHashes(
                mnemonic,
                data.preimageHash,
                abortSignal,
            );
            if (abortSignal.aborted) {
                return -1;
            }
            log.debug(
                `Derived ${preimageMap.size} preimage hashes for this address`,
            );

            return preimageMap.size;
        }
    }

    return -1;
}

export const getHighestPreimageIndex = async (
    signerAddress: string,
    mnemonic: string,
    etherSwap: EtherSwap,
    abortSignal?: AbortSignal,
): Promise<number> => {
    const generator = preimagesGenerator(
        abortSignal ?? new AbortController().signal,
        signerAddress,
        mnemonic,
        etherSwap,
    );

    let result = await generator.next();
    while (!result.done) {
        result = await generator.next();
    }

    return result.value;
};
