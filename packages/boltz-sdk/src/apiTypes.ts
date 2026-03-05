import { type SwapType } from "./enums";

export type ReverseMinerFees = {
    lockup: number;
    claim: number;
};

export type PairLimits = {
    minimal: number;
    maximal: number;
};

export type PairType = {
    hash: string;
    rate: number;
};

export type SubmarinePairTypeTaproot = PairType & {
    limits: PairLimits & {
        maximalZeroConf: number;
        minimalBatched?: number;
    };
    fees: {
        minerFees: number;
        percentage: number;
        maximalRoutingFee?: number;
    };
};

export type ReversePairTypeTaproot = PairType & {
    limits: PairLimits;
    fees: {
        percentage: number;
        minerFees: ReverseMinerFees;
    };
};

export type ChainPairTypeTaproot = PairType & {
    limits: PairLimits & {
        maximalZeroConf: number;
    };
    fees: {
        percentage: number;
        minerFees: {
            server: number;
            user: {
                claim: number;
                lockup: number;
            };
        };
    };
};

export type SubmarinePairsTaproot = Record<
    string,
    Record<string, SubmarinePairTypeTaproot>
>;

export type ReversePairsTaproot = Record<
    string,
    Record<string, ReversePairTypeTaproot>
>;

export type ChainPairsTaproot = Record<
    string,
    Record<string, ChainPairTypeTaproot>
>;

export type Pairs = {
    [SwapType.Submarine]: SubmarinePairsTaproot;
    [SwapType.Reverse]: ReversePairsTaproot;
    [SwapType.Chain]: ChainPairsTaproot;
};

export type PartialSignature = {
    pubNonce: Uint8Array;
    signature: Uint8Array;
};

export type Contracts = {
    network: {
        chainId: number;
        name: string;
    };
    swapContracts: {
        EtherSwap: string;
        ERC20Swap: string;
    };
    supportedContracts: Record<
        string,
        {
            EtherSwap: string;
            ERC20Swap: string;
            features: string[];
        }
    >;
    tokens: Record<string, string>;
};

export type SwapTreeLeaf = {
    output: string;
    version: number;
};

export type SwapTree = {
    claimLeaf: SwapTreeLeaf;
    refundLeaf: SwapTreeLeaf;
};

export type SubmarineCreatedResponse = {
    id: string;
    address: string;
    bip21: string;
    swapTree: SwapTree;
    acceptZeroConf: boolean;
    expectedAmount: number;
    claimPublicKey: string;
    timeoutBlockHeight: number;
    blindingKey?: string;
    claimAddress?: string;
};

export type ReverseCreatedResponse = {
    id: string;
    invoice: string;
    swapTree: SwapTree;
    lockupAddress: string;
    timeoutBlockHeight: number;
    onchainAmount: number;
    refundPublicKey?: string;
    blindingKey?: string;
    refundAddress?: string;
};

export type ChainSwapDetails = {
    swapTree: SwapTree;
    lockupAddress: string;
    serverPublicKey: string;
    timeoutBlockHeight: number;
    amount: number;
    blindingKey?: string;
    refundAddress?: string;
    claimAddress?: string;
    bip21?: string;
};

export type ChainSwapCreatedResponse = {
    id: string;
    claimDetails: ChainSwapDetails;
    lockupDetails: ChainSwapDetails;
};

export type ChainSwapTransaction = {
    transaction: {
        id: string;
        hex?: string;
    };
    timeout: {
        blockHeight: number;
        eta?: number;
    };
};

export type RestorableSwapDetails = {
    tree: SwapTree;
    keyIndex: number;
    lockupAddress: string;
    serverPublicKey: string;
    timeoutBlockHeight: number;
    blindingKey?: string;
    amount?: number;
    transaction?: { id: string; vout: number };
    preimageHash?: string;
};

export type RestorableSwap = {
    id: string;
    type: SwapType;
    status: string;
    from: string;
    to: string;
    createdAt: number;
    claimPrivateKey?: string;
    claimDetails?: RestorableSwapDetails;
    refundDetails?: RestorableSwapDetails;
};

export type LockupTransaction = {
    id: string;
    hex: string;
    timeoutBlockHeight: number;
    timeoutEta?: number;
};

export type SwapStatus = {
    status: string;
    failureReason?: string;
    zeroConfRejected?: boolean;
    transaction?: {
        id: string;
        hex: string;
    };
};
