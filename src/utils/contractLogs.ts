import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { BytesLike, Result, Signer } from "ethers";
import { Contract, JsonRpcProvider } from "ethers";
import log from "loglevel";
import { RskRescueMode } from "src/pages/RescueExternal";

import { config } from "../config";
import type { AssetType } from "../consts/Assets";
import { RBTC } from "../consts/Assets";
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
    address?: string;
    refundAddress?: string;
    claimAddress?: string;
};

type ScanConfig = {
    filter?: ScanFilter;
    action?: RskRescueMode;
    mnemonic?: string;
};

type ScanResult = {
    progress: number;
    events: LogRefundData[];
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

async function createScanContext(
    etherSwap: EtherSwap,
): Promise<ScanContext | null> {
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
}

function eventMatchesAddress(event: LogRefundData, address: string): boolean {
    const normalized = address.toLowerCase();
    return (
        event.refundAddress.toLowerCase() === normalized ||
        event.claimAddress.toLowerCase() === normalized
    );
}

async function derivePreimageMap(
    mnemonic: string,
    targetHash: string,
    abortSignal: AbortSignal,
): Promise<{ map: PreimageMap; match: boolean } | null> {
    log.info("Deriving preimage hashes");

    const { map, match } = await new PreimageHashesWorker().deriveHashes(
        mnemonic,
        targetHash,
        abortSignal,
    );

    if (abortSignal.aborted) {
        return null;
    }

    log.debug(`Derived ${map.size} preimage hashes`);
    return { map, match };
}

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
    if (!filter) {
        return { isRefundable: false, isClaimable: false, matches: false };
    }

    const refundAddr = data.refundAddress.toLowerCase();
    const claimAddr = data.claimAddress.toLowerCase();

    if (filter.refundAddress) {
        const isRefundable = refundAddr === filter.refundAddress.toLowerCase();
        return { isRefundable, isClaimable: false, matches: isRefundable };
    }

    if (filter.claimAddress) {
        const isClaimable = claimAddr === filter.claimAddress.toLowerCase();
        return { isRefundable: false, isClaimable, matches: isClaimable };
    }

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

    let blocksScanned = 0;
    let preimageMap: PreimageMap = new Map();

    for (const ranges of generateBlockRangeBatches(
        ctx.latestBlock,
        ctx.minBlock,
    )) {
        if (abortSignal.aborted) {
            log.info(`Cancelling lockup event scan`);
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
        };

        for (const event of events) {
            const { data, decoded } = parseLockupEvent(etherSwap, event);
            const { isRefundable, isClaimable, matches } = matchesFilter(
                data,
                scanConfig.filter,
            );

            if (!matches) {
                continue;
            }

            log.debug(
                `Found relevant lockup event in: ${event.transactionHash}`,
            );

            if (isRefundable && scanConfig.action === RskRescueMode.Refund) {
                results.events.push(data);
                continue;
            }

            if (isClaimable && scanConfig.action === RskRescueMode.Claim) {
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

                if (preimageMap.size === 0) {
                    const { map } = await derivePreimageMap(
                        scanConfig.mnemonic,
                        data.preimageHash,
                        abortSignal,
                    );

                    preimageMap = map;
                }

                data.preimage = preimageMap.get(data.preimageHash)?.preimage;

                if (data.preimage !== undefined) {
                    results.events.push(data);
                }
            }
        }

        yield results;
    }

    log.info(`Finished lockup event scanning`);
}

/**
 * Finds the highest preimage key index used by an address.
 * Scans blockchain events and derives preimages to find the highest index.
 * Returns -1 if no events found or configuration is missing.
 */
export const getHighestKeyIndex = async (
    signerAddress: string,
    mnemonic: string,
    etherSwap: EtherSwap,
    abortSignal: AbortSignal = new AbortController().signal,
): Promise<number> => {
    if (!mnemonic) {
        log.warn("No mnemonic provided, skipping key index scan");
        return -1;
    }

    const ctx = await createScanContext(etherSwap);
    if (ctx === null) {
        log.warn("VITE_RSK_LOG_SCAN_ENDPOINT not set, skipping key index scan");
        return -1;
    }

    let preimageMap: PreimageMap = new Map();

    for (const ranges of generateBlockRangeBatches(
        ctx.latestBlock,
        ctx.minBlock,
    )) {
        if (abortSignal.aborted) {
            log.info(`Cancelling key index scan`);
            return -1;
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

        for (const event of events) {
            const { data } = parseLockupEvent(etherSwap, event);

            if (!eventMatchesAddress(data, signerAddress)) {
                continue;
            }

            log.debug(`Found event for address in: ${event.transactionHash}`);

            if (preimageMap.size === 0) {
                const { map, match } = await derivePreimageMap(
                    mnemonic,
                    data.preimageHash,
                    abortSignal,
                );

                preimageMap = map;

                if (match === true) {
                    return preimageMap.get(data.preimageHash)?.index ?? -1;
                }
            }
        }
    }

    return -1;
};
