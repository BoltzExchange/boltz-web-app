import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { BytesLike, Result, Signer } from "ethers";
import { Contract, JsonRpcProvider, solidityPackedKeccak256 } from "ethers";
import log from "loglevel";

import { config } from "../config";
import type { AssetType } from "../consts/Assets";
import { RBTC } from "../consts/Assets";
import { EtherSwapAbi } from "../context/Web3";
import { weiToSatoshi } from "./rootstock";

const scanInterval = 2_000;

export type LogRefundData = {
    asset: AssetType;
    blockNumber: number;
    transactionHash: string;

    preimageHash: string;
    amount: bigint;
    claimAddress: string;
    refundAddress: string;
    timelock: bigint;
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

async function* scanLogsForPossibleRefunds(
    abortSignal: AbortSignal,
    signer: Signer,
    etherSwap: EtherSwap,
) {
    const [signerAddress, latestBlock] = await Promise.all([
        signer.getAddress(),
        signer.provider.getBlockNumber(),
    ]);

    const deployHeight = config.assets[RBTC].contracts.deployHeight;
    const filter = etherSwap.filters.Lockup(null, null, null, signerAddress);

    log.info(
        `Scanning for possible refunds of ${signerAddress} from ${deployHeight} to ${latestBlock}`,
    );

    const scanProviderUrl = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (scanProviderUrl === undefined) {
        return;
    }

    const etherSwapScan = new Contract(
        await etherSwap.getAddress(),
        EtherSwapAbi,
        new JsonRpcProvider(scanProviderUrl),
    ) as unknown as EtherSwap;

    for (
        let toBlock = latestBlock;
        toBlock >= deployHeight;
        toBlock -= scanInterval
    ) {
        if (abortSignal.aborted) {
            log.info(`Cancelling refund log scan of: ${signerAddress}`);
            return;
        }

        const fromBlock = Math.max(toBlock - scanInterval, 0);
        log.debug(`Scanning possible refunds from ${fromBlock} to ${toBlock}`);
        const events = await etherSwapScan.queryFilter(
            filter,
            fromBlock,
            toBlock,
        );

        const results: { progress: number; events: LogRefundData[] } = {
            progress: (latestBlock - toBlock) / (latestBlock - deployHeight),
            events: [],
        };

        for (const event of events) {
            log.debug(`Found lockup event in: ${event.transactionHash}`);

            const { data, decoded } = parseLockupEvent(etherSwap, event);
            const stillLocked = await etherSwap.swaps(
                solidityPackedKeccak256(
                    ["bytes32", "uint256", "address", "address", "uint256"],
                    [
                        decoded[0],
                        decoded[1],
                        data.claimAddress,
                        data.refundAddress,
                        data.timelock,
                    ],
                ),
            );

            if (!stillLocked) {
                log.info(
                    `Lockup event in ${event.transactionHash} already spent`,
                );
                continue;
            }

            log.info(
                `Found lockup event that is still locked in: ${event.transactionHash}`,
            );
            results.events.push(data);
        }

        yield results;
    }

    log.info(`Finished refund log scanning for ${signerAddress}`);
}

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

export { scanLogsForPossibleRefunds };
