import log from "loglevel";

import type { PreimageHashMessage } from "./preimageHashes.worker";

export type PreimageEntry = { preimage: string; index: number };
export type PreimageMap = Map<string, PreimageEntry>;

export class PreimageHashesWorker {
    private worker: Worker;
    private _isDone = false;
    private batchResolver: () => void;

    readonly map: PreimageMap = new Map();

    get isDone() {
        return this._isDone;
    }

    constructor() {
        this.worker = new Worker(
            new URL("./preimageHashes.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
    }

    start = (mnemonic: string, abortSignal?: AbortSignal) => {
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

        this.worker.postMessage({ mnemonic });
    };

    waitForNextBatch = (): Promise<void> => {
        if (this._isDone) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.batchResolver = resolve;
        });
    };

    terminate = () => {
        if (this._isDone) {
            return;
        }
        this._isDone = true;
        this.batchResolver?.();
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
    };
}
