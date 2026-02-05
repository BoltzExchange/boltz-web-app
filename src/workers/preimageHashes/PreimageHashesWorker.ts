import log from "loglevel";

import type { PreimageHashMessage } from "./preimageHashes.worker";

export type PreimageEntry = { preimage: string; index: number };
export type PreimageMap = Map<string, PreimageEntry>;

export class PreimageHashesWorker {
    private worker: Worker;
    private isDone = false;
    private resolveDone: () => void;
    private pendingLookups = new Map<
        string,
        (entry: PreimageEntry | undefined) => void
    >();

    readonly map: PreimageMap = new Map();
    readonly done: Promise<void>;

    constructor() {
        this.worker = new Worker(
            new URL("./preimageHashes.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
        this.done = new Promise((r) => (this.resolveDone = r));
    }

    start(mnemonic: string, abortSignal?: AbortSignal) {
        abortSignal?.addEventListener("abort", () => this.finish(), {
            once: true,
        });

        this.worker.onmessage = ({
            data,
        }: MessageEvent<PreimageHashMessage>) => {
            for (const [hash, entry] of data.entries) {
                this.map.set(hash, entry);

                const resolve = this.pendingLookups.get(hash);
                if (resolve) {
                    resolve(entry);
                    this.pendingLookups.delete(hash);
                }
            }

            log.debug(`Derived ${this.map.size} preimage hashes`);

            if (data.done) {
                this.finish();
            }
        };

        this.worker.onerror = (error) => {
            log.error("PreimageHashes worker error", error);
            this.finish();
        };

        this.worker.postMessage({ mnemonic });
    }

    /**
     * Returns the entry if already derived, otherwise waits until
     * the worker derives it or finishes without finding it.
     */
    getPreimage(hash: string): Promise<PreimageEntry | undefined> {
        const entry = this.map.get(hash);
        if (entry) return Promise.resolve(entry);
        if (this.isDone) return Promise.resolve(undefined);
        return new Promise((r) => this.pendingLookups.set(hash, r));
    }

    terminate() {
        if (this.isDone) return;
        this.isDone = true;
        for (const resolve of this.pendingLookups.values()) {
            resolve(undefined);
        }
        this.pendingLookups.clear();
        this.resolveDone();
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
    }

    private finish() {
        this.terminate();
    }
}
