import log from "loglevel";

export type HighestIndexResult = number;

export class HighestIndexWorker {
    private worker: Worker;

    constructor() {
        this.worker = new Worker(
            new URL("./highestIndex.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
    }

    findHighestIndex(
        mnemonic: string,
        preimageHashes: string[],
    ): Promise<HighestIndexResult> {
        return new Promise((resolve) => {
            this.worker.onmessage = ({
                data,
            }: MessageEvent<HighestIndexResult>) => {
                resolve(data);
                this.terminate();
            };
            this.worker.onerror = (error) => {
                log.error("HighestIndex worker error", error);
                resolve(0);
                this.terminate();
            };
            this.worker.postMessage({ mnemonic, preimageHashes });
        });
    }

    terminate() {
        this.worker.terminate();
    }
}
