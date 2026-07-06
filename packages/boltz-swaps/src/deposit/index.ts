import { deriveDepositAddress } from "./derivation.ts";
import { previewDepositQuote } from "./quote.ts";
import type {
    CreateWatcherArgs,
    DepositQuote,
    DepositQuoteTarget,
    DepositSourceAsset,
    DepositWatcher,
} from "./types.ts";
import { createWatcher, resumeWatcher } from "./watcher.ts";

export {
    DEPOSIT_CONFIRMATIONS,
    DEPOSIT_SOURCE_ASSETS,
    DEPOSIT_BRIDGE_ASSET,
    DepositPhase,
    isTerminalPhase,
} from "./types.ts";
export { DepositRefundableError } from "./errors.ts";
export type {
    ApproveQuote,
    CreateWatcherArgs,
    DepositChainOut,
    DepositQuote,
    DepositQuoteTarget,
    DepositRecord,
    DepositResolveContext,
    DepositSourceAsset,
    DepositStorage,
    DepositWatcher,
    DetectedDeposit,
    ResolveOut,
} from "./types.ts";
export { createDepositStorage, createMemoryDepositStorage } from "./storage.ts";
export { deriveDepositAccount, deriveDepositAddress } from "./derivation.ts";
export { previewDepositQuote } from "./quote.ts";
export { createWatcher, resumeWatcher } from "./watcher.ts";

// The shape attached to `client.deposit` (see `createBoltzClient`).
export type DepositNamespace = {
    derive(args: { mnemonic: string; index?: number }): {
        index: number;
        address: string;
    };
    quote(args: {
        sourceAsset: DepositSourceAsset;
        amount: bigint;
        target: DepositQuoteTarget;
    }): Promise<DepositQuote>;
    createWatcher(args: CreateWatcherArgs): Promise<DepositWatcher>;
    resumeWatcher(args: CreateWatcherArgs): Promise<DepositWatcher>;
};

export const createDepositNamespace = (): DepositNamespace => ({
    derive: ({ mnemonic, index = 0 }) => ({
        index,
        address: deriveDepositAddress(mnemonic, index),
    }),
    quote: (args) => previewDepositQuote(args),
    createWatcher: (args) => createWatcher(args),
    resumeWatcher: (args) => resumeWatcher(args),
});
