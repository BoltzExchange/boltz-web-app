import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import log from "loglevel";

import { HighestIndexWorker } from "../workers/highestIndex/HighestIndexWorker";
import { getPreimageHashesForAddress } from "./contractLogs";
import { formatError } from "./errors";

export const scanForHighestPreimageIndex = async (
    address: string,
    mnemonic: string,
    etherSwap: EtherSwap,
): Promise<number> => {
    try {
        const preimageHashes = await getPreimageHashesForAddress(
            etherSwap,
            address,
        );

        if (preimageHashes.length === 0) {
            return 0;
        }

        log.info(
            `Found ${preimageHashes.length} lockup events for ${address}, scanning for highest index`,
        );

        const worker = new HighestIndexWorker();
        const highestIndex = await worker.findHighestIndex(
            mnemonic,
            preimageHashes,
        );

        if (highestIndex >= 0) {
            log.info(
                `Highest used preimage index for ${address}: ${highestIndex}`,
            );
        }

        return highestIndex;
    } catch (e) {
        log.error(
            `Failed to scan for highest preimage index: ${formatError(e)}`,
        );
        return -1;
    }
};
