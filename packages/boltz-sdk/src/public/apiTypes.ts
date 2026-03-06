import { type SwapType } from "./enums";

/** Miner fees for a reverse swap (split into lockup and claim). */
export type ReverseMinerFees = {
    /** Fee paid to lock funds on-chain. */
    lockup: number;
    /** Fee paid to claim funds on-chain. */
    claim: number;
};

/** Minimum and maximum amounts for a swap pair. */
export type PairLimits = {
    /** Minimum swap amount in satoshis. */
    minimal: number;
    /** Maximum swap amount in satoshis. */
    maximal: number;
};

/** Base shape shared by all pair types. */
export type PairType = {
    /** Hash identifying this pair configuration (used when creating swaps). */
    hash: string;
    /** Exchange rate between the two assets. */
    rate: number;
};

/** Pair configuration for Taproot submarine swaps. */
export type SubmarinePairTypeTaproot = PairType & {
    limits: PairLimits & {
        /** Maximum amount eligible for zero-conf acceptance. */
        maximalZeroConf: number;
        /** Minimum amount when batching is used. */
        minimalBatched?: number;
    };
    fees: {
        /** On-chain miner fee in satoshis. */
        minerFees: number;
        /** Boltz service fee as a percentage. */
        percentage: number;
        /** Maximum routing fee Boltz will pay when forwarding the Lightning payment. */
        maximalRoutingFee?: number;
    };
};

/** Pair configuration for Taproot reverse swaps. */
export type ReversePairTypeTaproot = PairType & {
    limits: PairLimits;
    fees: {
        /** Boltz service fee as a percentage. */
        percentage: number;
        /** Miner fees split into lockup and claim. */
        minerFees: ReverseMinerFees;
    };
};

/** Pair configuration for Taproot chain (on-chain ↔ on-chain) swaps. */
export type ChainPairTypeTaproot = PairType & {
    limits: PairLimits & {
        /** Maximum amount eligible for zero-conf acceptance. */
        maximalZeroConf: number;
    };
    fees: {
        /** Boltz service fee as a percentage. */
        percentage: number;
        minerFees: {
            /** Server-side miner fee in satoshis. */
            server: number;
            user: {
                /** User-side claim miner fee in satoshis. */
                claim: number;
                /** User-side lockup miner fee in satoshis. */
                lockup: number;
            };
        };
    };
};

/** Nested record of submarine pair configurations keyed by `from` → `to` asset. */
export type SubmarinePairsTaproot = Record<
    string,
    Record<string, SubmarinePairTypeTaproot>
>;

/** Nested record of reverse pair configurations keyed by `from` → `to` asset. */
export type ReversePairsTaproot = Record<
    string,
    Record<string, ReversePairTypeTaproot>
>;

/** Nested record of chain pair configurations keyed by `from` → `to` asset. */
export type ChainPairsTaproot = Record<
    string,
    Record<string, ChainPairTypeTaproot>
>;

/** All swap pair configurations grouped by swap type. */
export type Pairs = {
    [SwapType.Submarine]: SubmarinePairsTaproot;
    [SwapType.Reverse]: ReversePairsTaproot;
    [SwapType.Chain]: ChainPairsTaproot;
};

/** A MuSig2 partial signature with its public nonce. */
export type PartialSignature = {
    /** Public nonce used for the MuSig2 signing session. */
    pubNonce: Uint8Array;
    /** Partial Schnorr signature. */
    signature: Uint8Array;
};

/** EVM smart-contract addresses and metadata for a specific chain. */
export type Contracts = {
    /** Chain identification. */
    network: {
        /** EVM chain ID. */
        chainId: number;
        /** Human-readable chain name. */
        name: string;
    };
    /** Primary swap contract addresses. */
    swapContracts: {
        /** Address of the native Ether swap contract. */
        EtherSwap: string;
        /** Address of the ERC-20 swap contract. */
        ERC20Swap: string;
    };
    /** Additional supported contract sets with feature flags. */
    supportedContracts: Record<
        string,
        {
            EtherSwap: string;
            ERC20Swap: string;
            /** Feature identifiers supported by this contract set. */
            features: string[];
        }
    >;
    /** Mapping of token symbols to their contract addresses. */
    tokens: Record<string, string>;
};

/** A single leaf in a Taproot swap script tree. */
export type SwapTreeLeaf = {
    /** Hex-encoded script output. */
    output: string;
    /** Tapscript version (usually `0xc0`). */
    version: number;
};

/** The claim and refund script leaves that make up a swap's Taproot tree. */
export type SwapTree = {
    /** Leaf used by the claimer to spend the HTLC. */
    claimLeaf: SwapTreeLeaf;
    /** Leaf used by the refunder after timeout. */
    refundLeaf: SwapTreeLeaf;
};

/** Response returned by the API after creating a submarine swap. */
export type SubmarineCreatedResponse = {
    /** Swap identifier. */
    id: string;
    /** On-chain address to send funds to. */
    address: string;
    /** BIP-21 URI encoding address and amount. */
    bip21: string;
    /** Taproot script tree for the swap. */
    swapTree: SwapTree;
    /** Whether this swap qualifies for zero-confirmation acceptance. */
    acceptZeroConf: boolean;
    /** Expected on-chain amount in satoshis. */
    expectedAmount: number;
    /** Boltz's claim public key (hex). */
    claimPublicKey: string;
    /** Block height at which the swap times out. */
    timeoutBlockHeight: number;
    /** Liquid blinding key (hex), present only for L-BTC swaps. */
    blindingKey?: string;
    /** Address where Boltz will claim the swap to. */
    claimAddress?: string;
};

/** Response returned by the API after creating a reverse swap. */
export type ReverseCreatedResponse = {
    /** Swap identifier. */
    id: string;
    /** BOLT-11 invoice to pay. */
    invoice: string;
    /** Taproot script tree for the swap. */
    swapTree: SwapTree;
    /** On-chain address where Boltz locks funds. */
    lockupAddress: string;
    /** Block height at which the swap times out. */
    timeoutBlockHeight: number;
    /** On-chain amount that will be locked in satoshis. */
    onchainAmount: number;
    /** Boltz's refund public key (hex). */
    refundPublicKey?: string;
    /** Liquid blinding key (hex), present only for L-BTC swaps. */
    blindingKey?: string;
    /** Refund address. */
    refundAddress?: string;
};

/** Details for one side (claim or lockup) of a chain swap. */
export type ChainSwapDetails = {
    /** Taproot script tree. */
    swapTree: SwapTree;
    /** On-chain lockup address. */
    lockupAddress: string;
    /** Server's public key for this side of the swap (hex). */
    serverPublicKey: string;
    /** Block height at which this side times out. */
    timeoutBlockHeight: number;
    /** Amount in satoshis. */
    amount: number;
    /** Liquid blinding key (hex). */
    blindingKey?: string;
    /** Refund address. */
    refundAddress?: string;
    /** Claim address. */
    claimAddress?: string;
    /** BIP-21 URI for the lockup payment. */
    bip21?: string;
};

/** Response returned by the API after creating a chain swap. */
export type ChainSwapCreatedResponse = {
    /** Swap identifier. */
    id: string;
    /** Claim-side details (the chain the user receives on). */
    claimDetails: ChainSwapDetails;
    /** Lockup-side details (the chain the user sends on). */
    lockupDetails: ChainSwapDetails;
};

/** Transaction and timeout information for one side of a chain swap. */
export type ChainSwapTransaction = {
    transaction: {
        /** Transaction ID. */
        id: string;
        /** Raw transaction hex (may be absent before broadcast). */
        hex?: string;
    };
    timeout: {
        /** Block height at which the HTLC times out. */
        blockHeight: number;
        /** Estimated UNIX timestamp of the timeout block. */
        eta?: number;
    };
};

/** Swap details needed to restore / rescue a swap from backup. */
export type RestorableSwapDetails = {
    /** Taproot script tree. */
    tree: SwapTree;
    /** HD key derivation index. */
    keyIndex: number;
    /** On-chain lockup address. */
    lockupAddress: string;
    /** Server's public key (hex). */
    serverPublicKey: string;
    /** Block height at which the swap times out. */
    timeoutBlockHeight: number;
    /** Liquid blinding key (hex). */
    blindingKey?: string;
    /** Expected amount in satoshis. */
    amount?: number;
    /** Lockup transaction info when already broadcast. */
    transaction?: { id: string; vout: number };
    /** Preimage hash (hex). */
    preimageHash?: string;
};

/** Full restorable swap record returned by the `/v2/swap/restore` endpoint. */
export type RestorableSwap = {
    /** Swap identifier. */
    id: string;
    /** Swap direction. */
    type: SwapType;
    /** Current swap status string. */
    status: string;
    /** Source asset. */
    from: string;
    /** Destination asset. */
    to: string;
    /** UNIX timestamp (seconds) when the swap was created. */
    createdAt: number;
    /** Claim private key (hex), present for reverse / chain swaps. */
    claimPrivateKey?: string;
    /** Claim-side details for restoring. */
    claimDetails?: RestorableSwapDetails;
    /** Refund-side details for restoring. */
    refundDetails?: RestorableSwapDetails;
};

/** On-chain lockup transaction details returned by the API. */
export type LockupTransaction = {
    /** Transaction ID. */
    id: string;
    /** Raw transaction hex. */
    hex: string;
    /** Block height at which the HTLC times out. */
    timeoutBlockHeight: number;
    /** Estimated UNIX timestamp of the timeout block. */
    timeoutEta?: number;
};

/** Swap status information returned by the API. */
export type SwapStatus = {
    /** Current status string (see {@link swapStatusPending}, {@link swapStatusFailed}, {@link swapStatusSuccess}). */
    status: string;
    /** Human-readable failure reason, if the swap failed. */
    failureReason?: string;
    /** Details when the failure is due to an incorrect lockup amount. */
    failureDetails?: {
        /** Amount that was expected in satoshis. */
        expected: number;
        /** Amount that was actually received in satoshis. */
        actual: number;
    };
    /** Whether a zero-conf transaction was rejected. */
    zeroConfRejected?: boolean;
    /** Associated on-chain transaction, if any. */
    transaction?: {
        /** Transaction ID. */
        id: string;
        /** Raw transaction hex. May be absent for EVM transactions. */
        hex?: string;
        /** Estimated time in seconds until confirmation (for mempool transactions). */
        eta?: number;
    };
};

/** Swap status update received via WebSocket, includes the swap ID. */
export type SwapStatusUpdate = SwapStatus & {
    /** Swap identifier this update belongs to. */
    id: string;
};
