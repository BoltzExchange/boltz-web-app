import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import log from "loglevel";

import { getHighestKeyIndex } from "./contractLogs";
import type { SomeSwap } from "./swapCreator";

const retryDelay = 500;
const maxJump = 10;

const isPreimageCollision = (err: unknown): boolean =>
    typeof err === "string" && err.includes("preimage hash exists already");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves an EVM preimage collision by racing two parallel strategies:
 *
 * Chain scan: Scans on-chain lockup events for the signer
 * address and derives preimage hashes in a web worker to find the highest
 * previously used key index.  When it finds a match, the stored counter is
 * jumped ahead and one final swap attempt is made.
 *
 * Backend retry: Repeatedly calls `createSwap`, which internally calls
 * `newKey` (incrementing the stored counter) and tries to create the swap
 * on the backend.
 *
 * Component unmount / navigation aborts both via the shared signal.
 */
export const resolveEvmCollision = async (
    createSwap: () => Promise<SomeSwap>,
    scanParams: {
        address: string;
        mnemonic: string;
        etherSwap: EtherSwap;
    },
    keyOps: {
        get: () => Promise<number>;
        set: (v: number) => Promise<number>;
    },
    abortSignal: AbortSignal,
): Promise<SomeSwap> => {
    const scanAbort = new AbortController();

    const onExternalAbort = () => scanAbort.abort();
    abortSignal.addEventListener("abort", onExternalAbort, { once: true });

    const cleanup = () => {
        scanAbort.abort();
        abortSignal.removeEventListener("abort", onExternalAbort);
    };

    // Chain scan
    let highestIndex: number | null = null;

    const scanPromise = getHighestKeyIndex(
        scanParams.address,
        scanParams.mnemonic,
        scanParams.etherSwap,
        scanAbort.signal,
    )
        .then((index) => {
            highestIndex = index;
            log.info(`Chain scan found highest index: ${highestIndex}`);
        })
        .catch((err) => {
            highestIndex = -1;
            log.warn("Chain scan error", err);
        });

    // Backend retry loop with capped exponential jumps (1, 2, 4, 8, 10, 10, ...)
    let jump = 1;

    while (!abortSignal.aborted) {
        // Chain scan found the correct index, use it to create the swap
        if (highestIndex !== null && highestIndex > 0) {
            await keyOps.set(highestIndex + 1);

            cleanup();

            return await createSwap();
        }

        try {
            const swap = await createSwap();
            cleanup();
            return swap;
        } catch (err) {
            if (isPreimageCollision(err)) {
                // Double the jump, then skip the counter ahead
                jump = Math.min(jump * 2, maxJump);
                const current = await keyOps.get();
                await keyOps.set(current + jump - 1);

                await sleep(retryDelay);
                continue;
            }

            cleanup();
            throw err;
        }
    }

    // External abort was triggered (navigation / unmount)
    await scanPromise;
    cleanup();
    throw new Error("Preimage collision resolution aborted");
};
