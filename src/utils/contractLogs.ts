import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { Result, Signer, solidityPackedKeccak256 } from "ethers";
import log from "loglevel";

import { AssetType, RBTC } from "../consts/Assets";
import { weiToSatoshi } from "./rootstock";

const scanInterval = 10_000;

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
    log.info(`Scanning for possible refunds of: ${signerAddress}`);

    const filter = etherSwap.filters.Lockup(null, null, null, signerAddress);

    for (let toBlock = latestBlock; toBlock >= 0; toBlock -= scanInterval) {
        if (abortSignal.aborted) {
            log.info(`Cancelling refund log scan of: ${signerAddress}`);
            return;
        }

        const fromBlock = Math.max(toBlock - scanInterval, 0);
        log.debug(`Scanning possible refunds from ${fromBlock} to ${toBlock}`);
        const events = await etherSwap.queryFilter(filter, fromBlock, toBlock);

        const results: LogRefundData[] = [];

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
            results.push(data);
        }

        yield results;
    }

    log.info(`Finished refund log scanning for ${signerAddress}`);
}

const parseLockupEvent = (
    etherSwap: EtherSwap,
    event: any,
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
