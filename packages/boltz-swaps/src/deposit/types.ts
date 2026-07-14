// Types for the static reusable EVM-stablecoin deposit-address feature.
// Types only — no runtime imports, so this module never pulls anything into the
// package's eager `.` graph (`check:lazy`).
import type { PendingEvmCctpBridgeSend } from "../bridge/pendingSend.ts";
import type {
    ChainSwapCreatedResponse,
    SubmarineCreatedResponse,
} from "../client.ts";

export const DEPOSIT_SOURCE_ASSETS = [
    "USDC-POL",
    "USDC-ETH",
    "USDC-BASE",
] as const;

export type DepositSourceAsset = (typeof DEPOSIT_SOURCE_ASSETS)[number];

// txHash+logIndex are unique only within one chain; namespace by source asset
// so deposits observed on different chains can never share a dedup key.
export const encodeDepositId = (
    sourceAsset: DepositSourceAsset,
    sourceTxHash: string,
    logIndex: number,
): string => `${sourceAsset}:${sourceTxHash}:${logIndex}`;

// Confirmation depth before a detected transfer is acted on, so a reorged-out
// transfer never drives an irreversible sponsored CCTP burn; override via
// `CreateWatcherArgs.confirmations`.
export const DEPOSIT_CONFIRMATIONS: Record<DepositSourceAsset, number> = {
    "USDC-ETH": 12,
    "USDC-POL": 64,
    "USDC-BASE": 12,
};

// The canonical asset every deposit bridges to before swapping out.
export const DEPOSIT_BRIDGE_ASSET = "USDC";

export type DepositChainOut = "BTC" | "L-BTC";

export enum DepositPhase {
    Detected = "detected",
    Bridging = "bridging",
    AwaitingMint = "awaitingMint",
    Locking = "locking",
    Creating = "creating",
    AwaitingApproval = "awaitingApproval",
    Binding = "binding",
    Settling = "settling",
    Done = "done",
    Refunding = "refunding",
    Failed = "failed",
}

export const isTerminalPhase = (phase: DepositPhase): boolean =>
    phase === DepositPhase.Done || phase === DepositPhase.Failed;

// The SDK owns the preimage and (for chain out) the UTXO claim keypair, so the
// consumer only provides a Lightning destination or a chain address.
export type DepositQuoteTarget =
    | {
          type: "lightning";
          // A *fetchable* Lightning destination (LNURL, Lightning address,
          // BOLT12 offer, or BIP-353 name); the SDK fetches a fresh invoice
          // sized to the locked amount. A pre-made fixed-amount invoice is
          // rejected — its surplus would be forfeited to the server on claim.
          destination: string;
      }
    | { type: "chain"; to: DepositChainOut; address: string };

export type DetectedDeposit = {
    // Immutable identity from `encodeDepositId` — never a balance.
    id: string;
    sourceAsset: DepositSourceAsset;
    address: string;
    // Raw USDC (6dp) received on the source chain.
    amount: bigint;
    txHash: string;
    logIndex: number;
    blockNumber: number;
};

// Handed to `resolveOut` with the actual post-bridge amount so the consumer
// can size an LN invoice correctly (P1-4).
export type DepositResolveContext = {
    deposit: DetectedDeposit;
    // USDC (6dp) actually minted on Arbitrum, net of CCTP + forwarding fees.
    mintedAmount: bigint;
    // `mintedAmount` normalized to 8dp Boltz sats.
    mintedSats: number;
    // Informational; the SDK sizes the Lightning invoice to the locked amount.
    suggestedReceiveSats: number;
};

export type ResolveOut = (
    ctx: DepositResolveContext,
) => Promise<DepositQuoteTarget> | DepositQuoteTarget;

// Server-authoritative quote presented to `approveQuote` before binding.
export type DepositQuote = {
    depositId: string;
    swapId: string;
    target: "lightning" | "chain";
    // Sats committed on Arbitrum (the USDC lock, normalized to 8dp).
    lockAmountSats: number;
    receiveAsset: string;
    // Sats the recipient nets (server-authoritative).
    receiveAmountSats: number;
    // Bridge fee in raw USDC (6dp), as a string for JSON safety.
    bridgeFee: string;
    expiresAt?: number;
};

export type ApproveQuote = (quote: DepositQuote) => Promise<boolean> | boolean;

// The persisted unit of work. bigints are stored as decimal strings so records
// are plain JSON. One record per deposit, keyed on `id`.
export type DepositRecord = {
    id: string;
    phase: DepositPhase;
    sourceAsset: DepositSourceAsset;
    address: string;
    index: number;
    createdAt: number;
    updatedAt: number;

    // Detection
    amount: string; // USDC 6dp
    txHash: string;
    logIndex: number;
    blockNumber: number;

    // Bridging
    burnTxHash?: string;
    guid?: string;
    cctpNonce?: string;
    cctpMessage?: string;
    pendingSend?: PendingEvmCctpBridgeSend;

    // Mint
    // Absolute ms deadline for forwarded-mint polling before the manual
    // self-mint fallback; persisted so a resume does not reset it.
    mintDeadline?: number;
    mintTxHash?: string;
    mintedAmount?: string; // USDC 6dp

    // Lockup
    commitmentTxHash?: string;
    commitmentLogIndex?: number;

    // Out-swap
    target?: DepositQuoteTarget;
    swapId?: string;
    swapKind?: "chain" | "submarine";
    createdSwap?: ChainSwapCreatedResponse | SubmarineCreatedResponse;
    preimage?: string; // hex, chain out only
    preimageHash?: string; // hex
    claimPrivateKey?: string; // hex, SDK-generated UTXO claim key (chain out)
    blindingKey?: string; // from created swap (L-BTC)
    receiveAmountSats?: number;
    quote?: DepositQuote;
    // Persisted so a resume does not re-prompt for an already-answered
    // (possibly stale) quote.
    approved?: boolean;
    bound?: boolean;

    // Settle
    claimTxId?: string;

    // Refund / terminal
    refundTxHash?: string;
    error?: string;
};

// Injected persistence; watermarks + records survive restarts so the watcher
// can resume. Async so consumers can back it with a DB, file, or localStorage.
export interface DepositStorage {
    getWatermark(sourceAsset: string): Promise<number | undefined>;
    setWatermark(sourceAsset: string, block: number): Promise<void>;
    // Upsert by `record.id`. Presence of a record is also the dedup signal: the
    // watcher skips a scanned transfer whose id already has a record.
    putDeposit(record: DepositRecord): Promise<void>;
    getDeposit(id: string): Promise<DepositRecord | undefined>;
    // Records whose phase is not Done/Failed — what `resumeWatcher` re-spawns.
    listActiveDeposits(): Promise<DepositRecord[]>;
}

export type CreateWatcherArgs = {
    mnemonic: string;
    // HD address index (`m/44'/60'/0'/0/{index}`); default 0.
    index?: number;
    // Source chains to scan; default DEPOSIT_SOURCE_ASSETS.
    sourceAssets?: DepositSourceAsset[];
    storage: DepositStorage;
    resolveOut: ResolveOut;
    approveQuote: ApproveQuote;
    // Poll interval per source chain; default 15_000ms. Also caps the engine's
    // status/mint/bridge polling for deposits this watcher drives.
    pollIntervalMs?: number;
    // Confirmation depth per source chain; defaults to DEPOSIT_CONFIRMATIONS.
    confirmations?: Partial<Record<DepositSourceAsset, number>>;
    // Optional block to start scanning from on a fresh address (per chain).
    startBlocks?: Partial<Record<DepositSourceAsset, number>>;
    onEvent?: (record: DepositRecord) => void;
    onError?: (error: unknown) => void;
    signal?: AbortSignal;
};

export type DepositWatcher = {
    address: string;
    index: number;
    stop(): void;
};
