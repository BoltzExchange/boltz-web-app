import { type Address, getAddress, parseAbiItem } from "viem";

import { getTokenAddress } from "../config.ts";
import { generateBlockRangeBatches } from "../evm/blockRanges.ts";
import { createAssetProvider } from "../evm/provider.ts";
import { erc20Abi } from "../generated/evm-abis.ts";
import { getLogger } from "../logger.ts";

const transferEvent = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)",
);

// A single inbound ERC20 credit to the deposit address.
export type DetectedTransfer = {
    txHash: string;
    logIndex: number;
    blockNumber: number;
    from: string;
    amount: bigint;
};

export const getLatestBlock = async (sourceAsset: string): Promise<number> =>
    Number(await createAssetProvider(sourceAsset).getBlockNumber());

// Scan `[fromBlock, toBlock]` on a source chain for inbound USDC `Transfer`s to
// `address`. Keyed on the immutable `Transfer` log (txHash+logIndex), NOT on a
// balance read — a reusable address mixes deposits and leftovers, so balance is
// never a safe identity (P0-1). `getLogs` is filtered by the configured token
// contract, so a wrong-token transfer is never returned.
export const scanIncomingTransfers = async ({
    sourceAsset,
    address,
    fromBlock,
    toBlock,
}: {
    sourceAsset: string;
    address: string;
    fromBlock: number;
    toBlock: number;
}): Promise<DetectedTransfer[]> => {
    if (toBlock < fromBlock) {
        return [];
    }

    const provider = createAssetProvider(sourceAsset);
    const tokenAddress = getAddress(getTokenAddress(sourceAsset)) as Address;
    const to = getAddress(address) as Address;

    const ranges = [...generateBlockRangeBatches(toBlock, fromBlock)]
        .flat()
        .sort((a, b) => a.fromBlock - b.fromBlock);

    const transfers: DetectedTransfer[] = [];
    for (const range of ranges) {
        const logs = await provider.getLogs({
            address: tokenAddress,
            event: transferEvent,
            args: { to },
            fromBlock: BigInt(range.fromBlock),
            toBlock: BigInt(range.toBlock),
        });
        for (const log of logs) {
            if (log.transactionHash === null || log.logIndex === null) {
                continue; // pending log — skip until mined
            }
            transfers.push({
                txHash: log.transactionHash,
                logIndex: log.logIndex,
                blockNumber: Number(log.blockNumber),
                from: log.args.from ?? "",
                amount: log.args.value ?? 0n,
            });
        }
    }

    getLogger().debug("Scanned source-chain transfers", {
        sourceAsset,
        address,
        fromBlock,
        toBlock,
        found: transfers.length,
    });

    return transfers;
};

// Live balance read of the deposit address on a source chain — a coarse
// cross-check / fallback, never the source of deposit identity.
export const readSourceTokenBalance = (
    sourceAsset: string,
    address: string,
): Promise<bigint> =>
    createAssetProvider(sourceAsset).readContract({
        address: getAddress(getTokenAddress(sourceAsset)) as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [getAddress(address)],
    });
