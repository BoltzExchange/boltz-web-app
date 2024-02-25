// eslint-disable-next-line no-restricted-imports
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { Buffer } from "buffer";
// eslint-disable-next-line no-restricted-imports
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

export { LiquidNetwork, EtherSwap };

export type ReverseMinerFees = {
    lockup: number;
    claim: number;
};

export type LegacyMinerFees = {
    normal: number;
    reverse: ReverseMinerFees;
};

export type PairLimits = {
    minimal: number;
    maximal: number;
};

export type PairType = {
    hash: string;
    rate: number;
};

export type PairLegacy = PairType & {
    limits: PairLimits & {
        maximalZeroConf: {
            baseAsset: number;
            quoteAsset: number;
        };
    };
    fees: {
        percentage: number;
        percentageSwapIn: number;
        minerFees: {
            baseAsset: LegacyMinerFees;
            quoteAsset: LegacyMinerFees;
        };
    };
};

export type SubmarinePairTypeTaproot = PairType & {
    limits: PairLimits & {
        maximalZeroConf: number;
    };
    fees: {
        percentage: number;
        minerFees: number;
    };
};

export type ReversePairTypeTaproot = PairType & {
    limits: PairLimits;
    fees: {
        percentage: number;
        minerFees: ReverseMinerFees;
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

export type Pairs = {
    submarine: SubmarinePairsTaproot;
    reverse: ReversePairsTaproot;
};

export type PartialSignature = {
    pubNonce: Buffer;
    signature: Buffer;
};
export type Contracts = {
    network: {
        chainId: number;
    };
    tokens: Record<string, string>;
    swapContracts: {
        EtherSwap: string;
        ERC20Swap: string;
    };
};
export type NodeInfo = {
    publicKey: string;
    uris: string[];
};
