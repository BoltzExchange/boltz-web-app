import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { BytesLike, Result, Signer } from "ethers";
import { JsonRpcProvider } from "ethers";
import log from "loglevel";

import { config } from "../config";
import { AssetKind, type AssetType, getKindForAsset } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import {
    PreimageHashesWorker,
    type PreimageMap,
} from "../workers/preimageHashes/PreimageHashesWorker";
import { assetAmountToSats } from "./rootstock";

export type SwapContract = EtherSwap | ERC20Swap;

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
    tokenAddress?: string;
    claimAddress: string;
    refundAddress: string;
    timelock: bigint;
};

type ScanFilter = {
    address: string;
};

export type ScanConfig = {
    asset: AssetType;
    providerUrl: string;
    filter?: ScanFilter;
    action?: RskRescueMode;
    mnemonic?: string;
};

type ScanResult = {
    progress: number;
    events: LogRefundData[];
    derivedKeys?: number;
    unmatchedSwaps: number;
};

type ScanContext = {
    asset: AssetType;
    isErc20: boolean;
    providerUrl: string;
    contractAddress: string;
    latestBlock: number;
    minBlock: number;
    contract: SwapContract;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: any;
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

const buildLockupFilter = (
    contract: SwapContract,
    isErc20: boolean,
    version: number,
    scanConfig: ScanConfig,
) => {
    if (scanConfig.filter?.address === undefined) {
        return contract.filters.Lockup();
    }

    if (isErc20) {
        const erc20 = contract as ERC20Swap;
        if (scanConfig.action === RskRescueMode.Refund) {
            return erc20.filters.Lockup(
                null,
                null,
                null,
                null,
                scanConfig.filter.address,
            );
        }
        if (scanConfig.action === RskRescueMode.Claim && version >= 6) {
            return erc20.filters.Lockup(
                null,
                null,
                null,
                scanConfig.filter.address,
            );
        }
        return erc20.filters.Lockup();
    }

    const etherSwap = contract as EtherSwap;
    if (scanConfig.action === RskRescueMode.Refund) {
        return etherSwap.filters.Lockup(
            null,
            null,
            null,
            scanConfig.filter.address,
        );
    }
    if (scanConfig.action === RskRescueMode.Claim && version >= 6) {
        return etherSwap.filters.Lockup(
            null,
            null,
            scanConfig.filter.address,
        );
    }
    return etherSwap.filters.Lockup();
};

const createScanContext = async (
    contract: SwapContract,
    scanConfig: ScanConfig,
): Promise<ScanContext | null> => {
    const { providerUrl, asset } = scanConfig;
    if (!providerUrl) {
        return null;
    }

    const isErc20 = getKindForAsset(asset) === AssetKind.ERC20;
    const contractAddress = await contract.getAddress();
    const provider = new JsonRpcProvider(providerUrl);
    const minBlock = config.assets[asset].contracts.deployHeight;

    const [latestBlock, versionBigInt] = await Promise.all([
        provider.getBlockNumber(),
        contract.version(),
    ]);
    const version = Number(versionBigInt);

    const filter = buildLockupFilter(contract, isErc20, version, scanConfig);

    return {
        asset,
        isErc20,
        filter,
        providerUrl,
        contractAddress,
        latestBlock,
        minBlock,
        totalBlocks: latestBlock - minBlock,
        contract: contract.connect(provider) as SwapContract,
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
    contract: SwapContract,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: any,
): Promise<LockupEvent[]> => {
    const results = await Promise.all(
        ranges.map(({ fromBlock, toBlock }) =>
            contract.queryFilter(filter, fromBlock, toBlock),
        ),
    );

    return results.flat().sort((a, b) => b.blockNumber - a.blockNumber);
};

const parseLockupEvent = (
    asset: AssetType,
    isErc20: boolean,
    contract: SwapContract,
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
    const decoded = contract.interface.decodeEventLog(
        contract.interface.getEvent("Lockup"),
        event.data,
        event.topics,
    );

    return {
        decoded,
        data: {
            asset,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            preimageHash: decoded[0].substring(2),
            amount: assetAmountToSats(decoded[1], asset),
            tokenAddress: isErc20 ? decoded[2] : undefined,
            claimAddress: isErc20 ? decoded[3] : decoded[2],
            refundAddress: isErc20 ? decoded[4] : decoded[3],
            timelock: isErc20 ? decoded[5] : decoded[4],
        },
    };
};

const computeSwapHash = async (
    contract: SwapContract,
    isErc20: boolean,
    decoded: Result,
    data: LogRefundData,
): Promise<string> => {
    if (isErc20) {
        return await (contract as ERC20Swap).hashValues(
            decoded[0],
            decoded[1],
            data.tokenAddress,
            data.claimAddress,
            data.refundAddress,
            data.timelock,
        );
    }
    return await (contract as EtherSwap).hashValues(
        decoded[0],
        decoded[1],
        data.claimAddress,
        data.refundAddress,
        data.timelock,
    );
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
    asset: AssetType,
    contract: SwapContract,
    txHash: string,
): Promise<LogRefundData> => {
    const receipt = await signer.provider.getTransactionReceipt(txHash);

    if (receipt === null) {
        throw new Error(`Transaction receipt not found for ${txHash}`);
    }

    const isErc20 = getKindForAsset(asset) === AssetKind.ERC20;

    for (const event of receipt.logs) {
        if (
            event.topics[0] !== contract.interface.getEvent("Lockup").topicHash
        ) {
            continue;
        }

        return parseLockupEvent(asset, isErc20, contract, event).data;
    }

    throw new Error(`Lockup event not found in transaction ${txHash}`);
};

/**
 * Unified generator for scanning lockup events with configurable filtering.
 * Yields progress and events for each batch of blocks scanned.
 */
export async function* scanLockupEvents(
    abortSignal: AbortSignal,
    contract: SwapContract,
    scanConfig: ScanConfig,
): AsyncGenerator<ScanResult> {
    const ctx = await createScanContext(contract, scanConfig);
    if (ctx === null) {
        return;
    }

    const needsPreimages =
        scanConfig.action === RskRescueMode.Claim && scanConfig.mnemonic;
    const worker = needsPreimages ? new PreimageHashesWorker() : null;
    if (worker) {
        log.info("Starting preimage derivation in background");
        worker.start(
            scanConfig.mnemonic,
            config.assets[scanConfig.asset].network.chainId,
            abortSignal,
        );
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
            ctx.contract,
            ctx.filter,
        );

        blocksScanned += ranges.length * scanInterval;
        const results: ScanResult = {
            progress: Math.min(blocksScanned / ctx.totalBlocks, 1),
            events: [],
            derivedKeys: worker?.map.size,
            unmatchedSwaps: 0,
        };

        for (const event of events) {
            const { data, decoded } = parseLockupEvent(
                ctx.asset,
                ctx.isErc20,
                ctx.contract,
                event,
            );
            const match = matchesFilter(data, scanConfig.filter);

            if (match === null || match !== scanConfig.action) {
                continue;
            }

            log.debug(
                `Found relevant lockup event in: ${event.transactionHash}`,
            );

            const swapHash = await computeSwapHash(
                ctx.contract,
                ctx.isErc20,
                decoded,
                data,
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

        results.unmatchedSwaps = pendingClaims.length;

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
                unmatchedSwaps: pendingClaims.length,
            };
        }
    }

    worker?.terminate();
    log.info(`Finished lockup event scanning`);
}
