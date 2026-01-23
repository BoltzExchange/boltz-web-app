import log from "loglevel";

export type FindPreimageResult = string | null;

export class PreimageWorker {
    private worker: Worker;

    constructor() {
        this.worker = new Worker(
            new URL("./preimage.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
    }

    // brute-force find the preimage for a given mnemonic and preimage hash
    findPreimage(
        mnemonic: string,
        preimageHash: string,
    ): Promise<FindPreimageResult> {
        return new Promise((resolve) => {
            this.worker.onmessage = ({
                data,
            }: MessageEvent<FindPreimageResult>) => {
                resolve(data);
                this.terminate();
            };
            this.worker.onerror = (error) => {
                log.error("Preimage worker error", error);
                resolve(null);
                this.terminate();
            };
            this.worker.postMessage({ mnemonic, preimageHash });
        });
    }

    terminate() {
        this.worker.terminate();
    }
}
