import log from "loglevel";

import type { PreimageHashPair } from "./preimageHashes.worker";

// Map of preimageHash -> preimage
export type PreimageMap = Map<string, string>;

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

    deriveHashes(mnemonic: string, target: string): Promise<PreimageMap> {
        return new Promise((resolve) => {
            this.worker.onmessage = ({
                data,
            }: MessageEvent<PreimageHashPair[]>) => {
                resolve(new Map(data));
                this.terminate();
            };
            this.worker.onerror = (error) => {
                log.error("PreimageHashes worker error", error);
                resolve(new Map());
                this.terminate();
            };
            this.worker.postMessage({ mnemonic, target });
        });
    }

    terminate() {
        this.worker.terminate();
    }
}
