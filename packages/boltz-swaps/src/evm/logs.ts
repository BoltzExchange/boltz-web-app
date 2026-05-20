import {
    type AbiEvent,
    type Address,
    type Hash,
    type Hex,
    type Log,
    type PublicClient,
    getAbiItem,
    getAddress,
    getContract,
    isAddressEqual,
    parseEventLogs,
    toHex,
} from "viem";

import {
    getContractDeployHeight,
    getKindForAsset,
    getTokenAddress,
    requireChainId,
} from "../config.ts";
import { erc20SwapAbi, etherSwapAbi } from "../generated/evm-abis.ts";
import type {
    PreimageDerivation,
    PreimageMap,
} from "../interfaces/preimageMap.ts";
import { getLogger } from "../logger.ts";
import {
    AssetKind,
    type AssetType,
    type LogRefundData,
    RskRescueMode,
    arbitrumChainId,
} from "../types.ts";
import { resolveErc20SwapAbi, resolveEtherSwapAbi } from "./abis/index.ts";
import {
    type BlockRange,
    defaultScanInterval,
    generateBlockRangeBatches,
} from "./blockRanges.ts";
import type { Erc20SwapContract, EtherSwapContract } from "./contracts.ts";
import { prefix0x } from "./prefix0x.ts";
import { createAssetProvider, createProvider } from "./provider.ts";

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
    let chainId: number | undefined;
    try {
        chainId = requireChainId(asset);
    } catch {
        chainId = undefined;
    }

    if (chainId === arbitrumChainId) {
        const rpcProvider = createAssetProvider(asset);
        const block = (await rpcProvider.request({
            method: "eth_getBlockByNumber",
            params: ["latest", false],
        } as never)) as { l1BlockNumber: string };
        return Number(block.l1BlockNumber);
    }

    return Number(await provider.getBlockNumber());
};

export const getRollupL1BlockNumber = async (
    asset: AssetType,
    rollupBlockNumber: number,
): Promise<number> => {
    let chainId: number | undefined;
    try {
        chainId = requireChainId(asset);
    } catch {
        chainId = undefined;
    }

    if (chainId !== arbitrumChainId) {
        return rollupBlockNumber;
    }

    const rpcProvider = createAssetProvider(asset);
    const block = (await rpcProvider.request({
        method: "eth_getBlockByNumber",
        params: [toHex(rollupBlockNumber), false],
    } as never)) as { l1BlockNumber: string };
    return Number(block.l1BlockNumber);
};

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
    tokenAddress?: Address;
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
    const contractAddress = contract.address;
    const minBlock = getContractDeployHeight(asset) ?? 0;
    const tokenAddress = isErc20
        ? getAddress(getTokenAddress(asset))
        : undefined;

    const [latestBlock, version] = await Promise.all([
        provider.getBlockNumber().then(Number),
        provider
            .readContract({
                address: contractAddress,
                abi: isErc20 ? erc20SwapAbi : etherSwapAbi,
                functionName: "version",
            })
            .then(Number),
    ]);

    const abi: LockupAbi = isErc20
        ? resolveErc20SwapAbi(version)
        : resolveEtherSwapAbi(version);
    const args = buildLockupFilterArgs(version, scanConfig);

    const scopedContract: SwapContract = isErc20
        ? getContract({
              address: contractAddress,
              abi: resolveErc20SwapAbi(version),
              client: { public: provider },
          })
        : getContract({
              address: contractAddress,
              abi: resolveEtherSwapAbi(version),
              client: { public: provider },
          });

    const interval = scanConfig.scanInterval ?? defaultScanInterval;

    return {
        asset,
        isErc20,
        tokenAddress,
        abi,
        args,
        providerUrl,
        contractAddress,
        provider,
        latestBlock,
        minBlock,
        scanInterval: interval,
        totalBlocks: latestBlock - minBlock,
        contract: scopedContract,
    };
};

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
    const isErc20 = getKindForAsset(asset) === AssetKind.ERC20;
    const swapReadContract = contract as unknown as SwapReadContract;

    const [receipt, version] = await Promise.all([
        provider.getTransactionReceipt({ hash: txHash as Hash }),
        swapReadContract.read.version().then(Number),
    ]);

    if (receipt === null) {
        throw new Error(`Transaction receipt not found for ${txHash}`);
    }

    const abi: LockupAbi = isErc20
        ? resolveErc20SwapAbi(version)
        : resolveEtherSwapAbi(version);
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

export async function* scanLockupEvents(
    abortSignal: AbortSignal,
    contract: SwapContract,
    scanConfig: ScanConfig,
    derivation?: PreimageDerivation,
): AsyncGenerator<ScanResult> {
    const log = getLogger();
    const ctx = await createScanContext(contract, scanConfig);
    if (ctx === null) {
        return;
    }

    const needsPreimages =
        scanConfig.action === RskRescueMode.Claim && scanConfig.mnemonic;
    const worker =
        needsPreimages && derivation !== undefined ? derivation : null;
    if (worker) {
        log.info("Starting preimage derivation in background");
        let chainId: number | undefined;
        try {
            chainId = requireChainId(scanConfig.asset);
        } catch {
            chainId = undefined;
        }
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
            if (
                ctx.isErc20 &&
                (data.tokenAddress === undefined ||
                    ctx.tokenAddress === undefined ||
                    !isAddressEqual(data.tokenAddress, ctx.tokenAddress))
            ) {
                continue;
            }

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
