import log from "loglevel";
import {
    type AbiEvent,
    type Address,
    type Hash,
    type Hex,
    type Log,
    type PublicClient,
    getAbiItem,
    getAddress,
    isAddressEqual,
    parseEventLogs,
    toHex,
} from "viem";

import { config } from "../config";
import { arbitrumChainId } from "../configs/base";
import { AssetKind, type AssetType, getKindForAsset } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import type {
    Erc20SwapContract,
    EtherSwapContract,
} from "../context/contracts";
import { erc20SwapAbi, etherSwapAbi } from "../generated/evm-abis";
import {
    PreimageHashesWorker,
    type PreimageMap,
} from "../workers/preimageHashes/PreimageHashesWorker";
import { prefix0x } from "./evmTransaction";
import { createAssetProvider, createProvider } from "./provider";

export type SwapContract = EtherSwapContract | Erc20SwapContract;
type SwapReadContract = {
    address: Address;
    read: {
        version: (args?: readonly []) => Promise<unknown>;
        hashValues: (args: readonly unknown[]) => Promise<Hex>;
        swaps: (args: readonly [Hex]) => Promise<boolean>;
    };
};

/**
 * Returns the block number used for timelock comparison.
 * On Arbitrum, the contract's `block.number` is the L1 block number,
 * while `provider.getBlockNumber()` returns L2 — so we fetch L1 instead.
 */
export const getTimelockBlockNumber = async (
    provider: PublicClient,
    asset: AssetType,
): Promise<number> => {
    const network = config.assets?.[asset as string]?.network;

    if (network?.chainId === arbitrumChainId) {
        const rpcProvider = createAssetProvider(asset as string);
        const block = (await rpcProvider.request({
            method: "eth_getBlockByNumber",
            params: ["latest", false],
        } as never)) as { l1BlockNumber: string };
        return Number(block.l1BlockNumber);
    }

    return Number(await provider.getBlockNumber());
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

    if (network?.chainId !== arbitrumChainId) {
        return rollupBlockNumber;
    }

    const rpcProvider = createAssetProvider(asset as string);
    const block = (await rpcProvider.request({
        method: "eth_getBlockByNumber",
        params: [toHex(rollupBlockNumber), false],
    } as never)) as { l1BlockNumber: string };
    return Number(block.l1BlockNumber);
};

const defaultScanInterval = 2_000;
const parallelBatchSize = 5;

type LockupAbi = typeof erc20SwapAbi | typeof etherSwapAbi;

type LockupArgs = {
    refundAddress?: Address;
    claimAddress?: Address;
};

type LockupEventArgs = {
    preimageHash: Hex;
    amount: bigint;
    tokenAddress?: Address;
    claimAddress: Address;
    refundAddress: Address;
    timelock: bigint;
};

type LockupLog = Log<bigint, number, false, AbiEvent, true> & {
    eventName: "Lockup";
    args: LockupEventArgs;
};

type BlockRange = { fromBlock: number; toBlock: number };

export type LogRefundData = {
    asset: AssetType;
    blockNumber: number;
    transactionHash: Hex;

    preimageHash: Hex;
    preimage?: Hex;
    amount: bigint;
    tokenAddress?: Address;
    claimAddress: Address;
    refundAddress: Address;
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
    contractAddress: Address;
    latestBlock: number;
    minBlock: number;
    scanInterval: number;
    contract: SwapContract;
    provider: PublicClient;
    abi: LockupAbi;
    args?: LockupArgs;
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
            pendingClaims[i].preimage = entry.preimage as Hex;
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

/**
 * Builds args to pass to viem's `getLogs` for native indexed-topic filtering.
 * When extra addresses are present (e.g. gas abstraction signer), or when
 * filtering by claimAddress on a v5 contract (claimAddress not indexed),
 * returns undefined so `matchesFilter` does the post-filtering.
 */
const buildLockupFilterArgs = (
    version: number,
    scanConfig: ScanConfig,
): LockupArgs | undefined => {
    if (scanConfig.filter?.address === undefined) {
        return undefined;
    }

    const hasExtra =
        scanConfig.filter.extraAddresses &&
        scanConfig.filter.extraAddresses.length > 0;
    if (hasExtra) {
        return undefined;
    }

    const indexedAddress = getAddress(scanConfig.filter.address);

    if (scanConfig.action === RskRescueMode.Refund) {
        return { refundAddress: indexedAddress };
    }

    // claimAddress is only indexed on v6+ for both EtherSwap and ERC20Swap.
    if (scanConfig.action === RskRescueMode.Claim && version >= 6) {
        return { claimAddress: indexedAddress };
    }

    return undefined;
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
    const provider = createProvider([providerUrl]);
    const connected = contract as SwapContract;
    const contractAddress = connected.address;
    const minBlock = config.assets?.[asset]?.contracts?.deployHeight ?? 0;
    const swapReadContract = connected as unknown as SwapReadContract;

    const [latestBlock, version] = await Promise.all([
        provider.getBlockNumber().then(Number),
        swapReadContract.read.version().then(Number),
    ]);

    const abi: LockupAbi = isErc20 ? erc20SwapAbi : etherSwapAbi;
    const args = buildLockupFilterArgs(version, scanConfig);

    const interval = scanConfig.scanInterval ?? defaultScanInterval;

    return {
        asset,
        isErc20,
        abi,
        args,
        providerUrl,
        contractAddress,
        provider,
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
 * Fetches Lockup events for multiple block ranges in parallel using viem's
 * native indexed-topic filtering. Returns decoded events sorted by block
 * number descending (most recent first).
 */
const fetchEventsForRanges = async (
    ranges: BlockRange[],
    provider: PublicClient,
    address: Address,
    abi: LockupAbi,
    args: LockupArgs | undefined,
): Promise<LockupLog[]> => {
    const event = getAbiItem({ abi, name: "Lockup" }) as AbiEvent;

    const results = await Promise.all(
        ranges.map(({ fromBlock, toBlock }) =>
            provider.getLogs({
                address,
                event,
                args,
                fromBlock: BigInt(fromBlock),
                toBlock: BigInt(toBlock),
            }),
        ),
    );

    return (results.flat() as LockupLog[]).sort(
        (a, b) => Number(b.blockNumber) - Number(a.blockNumber),
    );
};

const lockupLogToRefundData = (
    asset: AssetType,
    event: LockupLog,
): LogRefundData => ({
    asset,
    blockNumber: Number(event.blockNumber),
    transactionHash: event.transactionHash,
    preimageHash: event.args.preimageHash.replace(/^0x/, "") as Hex,
    amount: event.args.amount,
    tokenAddress: event.args.tokenAddress,
    claimAddress: event.args.claimAddress,
    refundAddress: event.args.refundAddress,
    timelock: event.args.timelock,
});

const computeSwapHash = async (
    contract: SwapContract,
    isErc20: boolean,
    data: LogRefundData,
): Promise<string> => {
    const swapReadContract = contract as unknown as SwapReadContract;
    if (isErc20) {
        return await swapReadContract.read.hashValues([
            prefix0x(data.preimageHash),
            data.amount,
            getAddress(data.tokenAddress!),
            getAddress(data.claimAddress),
            getAddress(data.refundAddress),
            data.timelock,
        ]);
    }
    return await swapReadContract.read.hashValues([
        prefix0x(data.preimageHash),
        data.amount,
        getAddress(data.claimAddress),
        getAddress(data.refundAddress),
        data.timelock,
    ]);
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
    provider: PublicClient,
    asset: AssetType,
    contract: SwapContract,
    txHash: string,
): Promise<LogRefundData> => {
    const contractAddress = contract.address;
    const receipt = await provider.getTransactionReceipt({
        hash: txHash as Hash,
    });

    if (receipt === null) {
        throw new Error(`Transaction receipt not found for ${txHash}`);
    }

    const abi: LockupAbi =
        getKindForAsset(asset) === AssetKind.ERC20
            ? erc20SwapAbi
            : etherSwapAbi;
    const [lockupLog] = parseEventLogs({
        abi,
        eventName: "Lockup",
        logs: receipt.logs,
    }).filter((eventLog) => isAddressEqual(eventLog.address, contractAddress));

    if (lockupLog === undefined) {
        throw new Error(`Lockup event not found in transaction ${txHash}`);
    }

    const data = lockupLogToRefundData(asset, lockupLog as LockupLog);
    data.blockNumber = await getRollupL1BlockNumber(asset, data.blockNumber);
    return data;
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
        const chainId = config.assets?.[scanConfig.asset]?.network?.chainId;
        if (scanConfig.mnemonic === undefined || chainId === undefined) {
            return;
        }
        worker.start(scanConfig.mnemonic, chainId, abortSignal);
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
            ctx.provider,
            ctx.contractAddress,
            ctx.abi,
            ctx.args,
        );

        blocksScanned += ranges.length * ctx.scanInterval;
        const results: ScanResult = {
            progress: Math.min(blocksScanned / ctx.totalBlocks, 1),
            events: [],
            derivedKeys: worker?.map.size,
            unmatchedSwaps: 0,
        };

        for (const event of events) {
            const data = lockupLogToRefundData(ctx.asset, event);
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
            const stillLocked = await (
                ctx.contract as unknown as SwapReadContract
            ).read.swaps([swapHash as Hex]);

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
