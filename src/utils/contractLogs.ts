import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { BytesLike, DeferredTopicFilter, Provider } from "ethers";
import { JsonRpcProvider, toBeHex } from "ethers";
import log from "loglevel";
import { arbitrumChainId } from "src/configs/base";

import { config } from "../config";
import { AssetKind, type AssetType, getKindForAsset } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { Network } from "../consts/Network";
import {
    PreimageHashesWorker,
    type PreimageMap,
} from "../workers/preimageHashes/PreimageHashesWorker";
import { createAssetProvider } from "./provider";
import { prefix0x } from "./rootstock";

export type SwapContract = EtherSwap | ERC20Swap;

/**
 * Returns the block number used for timelock comparison.
 * On Arbitrum, the contract's `block.number` is the L1 block number,
 * while `provider.getBlockNumber()` returns L2 — so we fetch L1 instead.
 */
export const getTimelockBlockNumber = async (
    provider: Provider,
    asset: AssetType,
): Promise<number> => {
    const network = config.assets?.[asset as string]?.network;

    if (network?.chainId === arbitrumChainId) {
        const rpcProvider = createAssetProvider(asset as string);
        const block = (await rpcProvider.send("eth_getBlockByNumber", [
            "latest",
            false,
        ])) as { l1BlockNumber: string };
        return Number(block.l1BlockNumber);
    }

    return provider.getBlockNumber();
};

/**
 * For Arbitrum, log/receipt `blockNumber` is the rollup (L2) height; the block
 * header includes `l1BlockNumber` (Ethereum L1). Elsewhere returns the input.
 */
export const getRollupL1BlockNumber = async (
    asset: AssetType,
    rollupBlockNumber: number,
): Promise<number> => {
    const network = config.assets?.[asset as string]?.network;

    if (network?.chainName !== Network.Arbitrum) {
        return rollupBlockNumber;
    }

    const rpcProvider = createAssetProvider(asset as string);
    const block = (await rpcProvider.send("eth_getBlockByNumber", [
        toBeHex(rollupBlockNumber),
        false,
    ])) as { l1BlockNumber: string };
    return Number(block.l1BlockNumber);
};

const defaultScanInterval = 2_000;
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
    extraAddresses?: string[];
};

export type ScanConfig = {
    asset: AssetType;
    providerUrl: string;
    scanInterval?: number;
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
    scanInterval: number;
    contract: SwapContract;
    filter: DeferredTopicFilter;
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

const getAllFilterAddresses = (filter: ScanFilter): string[] => {
    const addrs = [filter.address];
    if (filter.extraAddresses) {
        addrs.push(...filter.extraAddresses);
    }
    return addrs;
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

    // When extra addresses are present (e.g. gas abstraction signer), skip
    // the indexed topic filter and let matchesFilter handle post-filtering.
    const hasExtra =
        scanConfig.filter.extraAddresses &&
        scanConfig.filter.extraAddresses.length > 0;

    if (isErc20) {
        const erc20 = contract as ERC20Swap;
        if (scanConfig.action === RskRescueMode.Refund && !hasExtra) {
            return erc20.filters.Lockup(
                null,
                null,
                null,
                null,
                scanConfig.filter.address,
            );
        }
        if (
            scanConfig.action === RskRescueMode.Claim &&
            version >= 6 &&
            !hasExtra
        ) {
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
    if (scanConfig.action === RskRescueMode.Refund && !hasExtra) {
        return etherSwap.filters.Lockup(
            null,
            null,
            null,
            scanConfig.filter.address,
        );
    }
    if (
        scanConfig.action === RskRescueMode.Claim &&
        version >= 6 &&
        !hasExtra
    ) {
        return etherSwap.filters.Lockup(null, null, scanConfig.filter.address);
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
    const provider = new JsonRpcProvider(providerUrl);
    const connected = contract.connect(provider) as SwapContract;
    const contractAddress = await connected.getAddress();
    const minBlock = config.assets[asset].contracts.deployHeight;

    const [latestBlock, version] = await Promise.all([
        provider.getBlockNumber(),
        connected.version().then(Number),
    ]);

    const filter = buildLockupFilter(connected, isErc20, version, scanConfig);

    const interval = scanConfig.scanInterval ?? defaultScanInterval;

    return {
        asset,
        isErc20,
        filter,
        providerUrl,
        contractAddress,
        latestBlock,
        minBlock,
        scanInterval: interval,
        totalBlocks: latestBlock - minBlock,
        contract: connected,
    };
};

/**
 * Generates block ranges for scanning, from latest block down to min block.
 * Yields batches of ranges that can be fetched in parallel.
 */
function* generateBlockRangeBatches(
    latestBlock: number,
    minBlock: number,
    intervalSize = defaultScanInterval,
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
    filter: DeferredTopicFilter,
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
    contract: SwapContract,
    event: LockupEvent,
): LogRefundData => {
    const parsedLog = contract.interface.parseLog({
        data: event.data as string,
        topics: event.topics as string[],
    });

    if (parsedLog?.name !== "Lockup") {
        throw new Error("Failed to parse Lockup event");
    }

    const {
        preimageHash,
        amount,
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock,
    } = parsedLog.args;

    return {
        asset,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        preimageHash: (preimageHash as string).substring(2),
        amount,
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock,
    };
};

const computeSwapHash = async (
    contract: SwapContract,
    isErc20: boolean,
    data: LogRefundData,
): Promise<string> => {
    if (isErc20) {
        return await (contract as ERC20Swap).hashValues(
            prefix0x(data.preimageHash),
            data.amount,
            data.tokenAddress!,
            data.claimAddress,
            data.refundAddress,
            data.timelock,
        );
    }
    return await (contract as EtherSwap).hashValues(
        prefix0x(data.preimageHash),
        data.amount,
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
    const addresses = getAllFilterAddresses(filter).map((a) => a.toLowerCase());

    for (const addr of addresses) {
        if (claimAddr === addr) {
            return RskRescueMode.Claim;
        }
        if (refundAddr === addr) {
            return RskRescueMode.Refund;
        }
    }

    return null;
};

export const getLogsFromReceipt = async (
    provider: Provider,
    asset: AssetType,
    contract: SwapContract,
    txHash: string,
): Promise<LogRefundData> => {
    const [receipt, contractAddress] = await Promise.all([
        provider.getTransactionReceipt(txHash),
        contract.getAddress(),
    ]);

    if (receipt === null) {
        throw new Error(`Transaction receipt not found for ${txHash}`);
    }

    for (const event of receipt.logs) {
        if (event.address.toLowerCase() !== contractAddress.toLowerCase()) {
            continue;
        }

        if (
            event.topics[0] !== contract.interface.getEvent("Lockup").topicHash
        ) {
            continue;
        }

        const data = parseLockupEvent(asset, contract, event);
        data.blockNumber = await getRollupL1BlockNumber(
            asset,
            data.blockNumber,
        );
        return data;
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
        ctx.scanInterval,
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

        blocksScanned += ranges.length * ctx.scanInterval;
        const results: ScanResult = {
            progress: Math.min(blocksScanned / ctx.totalBlocks, 1),
            events: [],
            derivedKeys: worker?.map.size,
            unmatchedSwaps: 0,
        };

        for (const event of events) {
            const data = parseLockupEvent(ctx.asset, ctx.contract, event);
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

            data.blockNumber = await getRollupL1BlockNumber(
                ctx.asset,
                data.blockNumber,
            );

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
