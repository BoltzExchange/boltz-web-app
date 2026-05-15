import type { PreimageDerivation, PreimageMap } from "boltz-swaps/interfaces";
import log from "loglevel";

import type { PreimageHashMessage } from "./preimageHashes.worker";

export type { PreimageEntry, PreimageMap } from "boltz-swaps/interfaces";

export class PreimageHashesWorker implements PreimageDerivation {
    private worker: Worker;
    isDone = false;
    private batchResolver: (() => void) | undefined;

    readonly map: PreimageMap = new Map();

    constructor() {
        this.worker = new Worker(
            new URL("./preimageHashes.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
    }

    start = (mnemonic: string, chainId: number, abortSignal?: AbortSignal) => {
        abortSignal?.addEventListener("abort", () => this.terminate(), {
            once: true,
        });

        this.worker.onmessage = ({
            data,
        }: MessageEvent<PreimageHashMessage>) => {
            for (const [hash, entry] of data.entries) {
                this.map.set(hash, entry);
            }

            log.debug(`Derived ${this.map.size} preimage hashes`);

            this.batchResolver?.();

            if (data.done) {
                this.terminate();
            }
        };

        this.worker.onerror = (error) => {
            log.error("PreimageHashes worker error", error);
            this.terminate();
        };

        this.worker.postMessage({ mnemonic, chainId });
    };

    waitForNextBatch = (): Promise<void> => {
        if (this.isDone) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.batchResolver = resolve;
        });
    };

    terminate = () => {
        if (this.isDone) {
            return;
        }
        this.isDone = true;
        this.batchResolver?.();
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
    };
}
