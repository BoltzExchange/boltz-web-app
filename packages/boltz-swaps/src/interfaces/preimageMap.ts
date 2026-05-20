export type PreimageEntry = { preimage: string; index: number };
export type PreimageMap = Map<string, PreimageEntry>;

export interface PreimageDerivation {
    readonly map: PreimageMap;
    readonly isDone: boolean;
    start(mnemonic: string, chainId: number, abortSignal?: AbortSignal): void;
    waitForNextBatch(): Promise<void>;
    terminate(): void;
}
