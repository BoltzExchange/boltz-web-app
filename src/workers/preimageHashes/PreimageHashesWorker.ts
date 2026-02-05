import log from "loglevel";

import type { PreimageHashResult } from "./preimageHashes.worker";

// Map of preimageHash -> preimage
export type PreimageMap = Map<string, { preimage: string; index: number }>;

export class PreimageHashesWorker {
    private worker: Worker;

    constructor() {
        this.worker = new Worker(
            new URL("./preimageHashes.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
    }

    deriveHashes(
        mnemonic: string,
        target: string,
        abortSignal?: AbortSignal,
    ): Promise<{ map: PreimageMap; match: boolean }> {
        return new Promise((resolve, reject) => {
            abortSignal?.addEventListener(
                "abort",
                () => {
                    resolve({ map: new Map(), match: false });
                    this.terminate();
                },
                { once: true },
            );

            this.worker.onmessage = ({
                data,
            }: MessageEvent<PreimageHashResult>) => {
                resolve({
                    map: new Map(data.entries),
                    match: data.match,
                });
                this.terminate();
            };
            this.worker.onerror = (error) => {
                log.error("PreimageHashes worker error", error);
                reject(error);
                this.terminate();
            };
            this.worker.postMessage({ mnemonic, target });
        });
    }

    terminate() {
        this.worker.terminate();
    }
}
