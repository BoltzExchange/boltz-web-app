import { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { Signer } from "ethers";
import log from "loglevel";

import { weiToSatoshi } from "./rootstock";

const scanInterval = 10_000;

export type LogRefundData = {
    preimageHash: string;
    amount: bigint;
    claimAddress: string;
    refundAddress: string;
    timelock: bigint;
};

async function* scanLogsForPossibleRefunds(
    signer: Signer,
    etherSwap: EtherSwap,
) {
    const [signerAddress, latestBlock] = await Promise.all([
        signer.getAddress(),
        signer.provider.getBlockNumber(),
    ]);
    log.info(`Scanning for possible refunds of: ${signerAddress}`);

    const filter = etherSwap.filters.Lockup(null, null, null, signerAddress);
    const eventInterface = etherSwap.interface.getEvent("Lockup");

    for (let toBlock = latestBlock; toBlock >= 0; toBlock -= scanInterval) {
        const fromBlock = Math.max(toBlock - scanInterval, 0);
        log.debug(`Scanning possible refunds from ${fromBlock} to ${toBlock}`);
        const logs = await etherSwap.queryFilter(filter, fromBlock, toBlock);

        const results: LogRefundData[] = [];

        for (const log of logs) {
            const decoded = etherSwap.interface.decodeEventLog(
                eventInterface,
                log.data,
                log.topics,
            );
            const data = {
                preimageHash: decoded[0].substring(2),
                amount: weiToSatoshi(decoded[1]),
                claimAddress: decoded[2],
                refundAddress: decoded[3],
                timelock: decoded[4],
            };
            const stillLocked = await etherSwap.swaps(
                await etherSwap.hashValues(
                    decoded[0],
                    decoded[1],
                    data.claimAddress,
                    data.refundAddress,
                    data.timelock,
                ),
            );

            if (!stillLocked) {
                continue;
            }

            results.push(data);
        }

        yield results;
    }
}

export { scanLogsForPossibleRefunds };
