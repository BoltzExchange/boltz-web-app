import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import type BigNumber from "bignumber.js";
import { OutputType } from "boltz-core";
import type {
    BridgeDetails,
    BridgeRoute,
    PendingBridgeSend,
    PendingEvmBridgeSend,
} from "boltz-swaps/bridge";
import {
    type ChainSwapCreatedResponse,
    type ReverseCreatedResponse,
    type SubmarineCreatedResponse,
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
} from "boltz-swaps/client";
import type { AlchemyCall } from "boltz-swaps/evm";
import {
    type BridgeKind,
    GasAbstractionType,
    SwapPosition,
    SwapType,
} from "boltz-swaps/types";

import { type AssetType, LN, isEvmAsset } from "../consts/Assets";
import type { newKeyFn } from "../context/Global";
import type { EncodedHop } from "./Pair";
import { type RescueFile, derivePreimageFromRescueKey } from "./rescueFile";

export { GasAbstractionType };

export type DexDetail = {
    hops: EncodedHop[];

    // Whether hops run pre or post the Boltz swap
    position: SwapPosition;

    // Expected DEX amount at creation; updated with actual amount after execution.
    // For post-swap hops: expected output amount from the DEX.
    // For pre-swap hops: expected input amount to the DEX.
    quoteAmount: number | string;

    // For pre-swap hops, exact source amount to spend in the DEX.
    sourceAmount?: string;
};

export enum PreBridgeRecoveryStatus {
    Blocked = "blocked",
    Retrying = "retrying",
    Recovered = "recovered",
}

// Client-side recovery state for a pre-bridge swap whose DEX quote fell short
// while the funds were bridging. This is not a backend status.
export type PreBridgeRecovery = {
    status: PreBridgeRecoveryStatus;
    asset: string;
    amount: string;
    receiveCall?: AlchemyCall;
    txHash?: string;
};

export type BridgeDetail = BridgeRoute & {
    kind: BridgeKind;
    position: SwapPosition;
    sourceAmount?: string;
    txHash?: string;
    details?: BridgeDetails;
    pendingSend?: PendingBridgeSend;
    evmSendCandidate?: PendingEvmBridgeSend;
    refundAddress?: string;

    // Recovery state when a pre-bridge DEX quote falls short and the bridged
    // funds must be retried or refunded back to the original sender.
    recovery?: PreBridgeRecovery;
};

export type PendingBridgeSendCallbacks = {
    persist: (pending: PendingBridgeSend) => Promise<void>;
};

export type GasAbstraction = {
    lockup: GasAbstractionType;
    claim: GasAbstractionType;
};

export const createUniformGasAbstraction = (
    gasAbstraction: GasAbstractionType,
): GasAbstraction => ({
    lockup: gasAbstraction,
    claim: gasAbstraction,
});

export const noGasAbstraction = (): GasAbstraction =>
    createUniformGasAbstraction(GasAbstractionType.None);

export type SwapBaseData = {
    type: SwapType;
    status?: string;
    assetSend: string;
    assetReceive: string;
    getGasToken?: boolean;
    version: number;
    date: number;

    // Not set for submarine swaps; but set for interface compatibility
    claimTx?: string;
    refundTx?: string;
    lockupTx?: string;
    commitmentLockupTxHash?: string;
    commitmentLockupCallId?: string;
    commitmentSignatureSubmitted?: boolean;

    // Set when the backend permanently rejected the commitment post (e.g.
    // "insufficient amount"). The on-chain lockup is immutable, so retrying can
    // never succeed; this stops the retry loop and offers the user a refund.
    commitmentRejection?: { reason: string };

    gasAbstraction: GasAbstraction;
    signer?: string;
    // Set for hardware wallet signers
    derivationPath?: string;

    // Original user input (Lightning address/LNURL/BIP353/BOLT12) before resolution
    originalDestination?: string;

    // DEX route for routed swaps (e.g. USDT0 via TBTC).
    dex?: DexDetail;

    // Bridge routes for bridging before lockup or after claim.
    bridge?: BridgeDetail;
};

export type SwapBase = SwapBaseData & {
    sendAmount: number;
    receiveAmount: number;
};

export type SubmarineSwap = SwapBase &
    SubmarineCreatedResponse & {
        type: SwapType.Submarine;
        invoice: string;
        preimage?: string;
        refundPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility
        refundPrivateKey?: string;
    };

export type ReverseSwap = SwapBase &
    ReverseCreatedResponse & {
        type: SwapType.Reverse;
        preimage: string;
        claimAddress: string;
        claimPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility
        claimPrivateKey?: string;
    };

export type ChainSwap = SwapBase &
    ChainSwapCreatedResponse & {
        type: SwapType.Chain;
        preimage: string;
        claimAddress: string;
        claimPrivateKeyIndex?: number;
        refundPrivateKeyIndex?: number;
        magicRoutingHintSavedFees?: string;

        // Deprecated; used for backwards compatibility
        claimPrivateKey?: string;
        refundPrivateKey?: string;
    };

export type CommitmentSwap = SwapBaseData & {
    type: SwapType.Commitment;
    id: string;
    initialReceiveAsset: string;
    sourceAsset: string;
    sourceAmount: string;
    timeoutBlockHeight?: number;
};

export type SomeSwap = SubmarineSwap | ReverseSwap | ChainSwap | CommitmentSwap;

export const isCommitmentSwap = (swap: SwapBaseData): swap is CommitmentSwap =>
    swap.type === SwapType.Commitment;

export const getLockupGasAbstraction = (
    swap: SwapBaseData,
): GasAbstractionType => swap.gasAbstraction.lockup;

export const getClaimGasAbstraction = (
    swap: SwapBaseData,
): GasAbstractionType => swap.gasAbstraction.claim;

export const getRelevantAssetForSwap = (swap: SwapBaseData) => {
    switch (swap.type) {
        case SwapType.Submarine:
        case SwapType.Commitment:
            return swap.assetSend;

        default:
            return swap.assetReceive;
    }
};

export const getSwapAddress = (swap: SomeSwap): string => {
    switch (swap.type) {
        case SwapType.Submarine:
            return swap.address;
        case SwapType.Reverse:
            return swap.lockupAddress;
        case SwapType.Chain:
            return swap.lockupDetails.lockupAddress;
        case SwapType.Commitment:
            return "";
    }
};

export const getFinalAssetSend = (
    swap: SwapBaseData,
    coalesceLn: boolean = false,
): string => {
    if (isCommitmentSwap(swap)) {
        return swap.sourceAsset;
    }

    if (swap.bridge?.position === SwapPosition.Pre) {
        return swap.bridge.sourceAsset;
    }

    if (
        swap.dex !== undefined &&
        swap.dex.position === SwapPosition.Pre &&
        swap.dex.hops.length > 0
    ) {
        return swap.dex.hops[0].from;
    }

    return coalesceLn && swap.type === SwapType.Reverse ? LN : swap.assetSend;
};

export const getFinalAssetReceive = (
    swap: SwapBaseData,
    coalesceLn: boolean = false,
): string => {
    if (isCommitmentSwap(swap)) {
        return swap.initialReceiveAsset;
    }

    if (swap.bridge?.position === SwapPosition.Post) {
        return swap.bridge.destinationAsset;
    }

    if (
        swap.dex !== undefined &&
        swap.dex.position === SwapPosition.Post &&
        swap.dex.hops.length > 0
    ) {
        return swap.dex.hops[swap.dex.hops.length - 1].to;
    }

    return coalesceLn && swap.type === SwapType.Submarine
        ? LN
        : swap.assetReceive;
};

export const isEvmSwap = (swap: SomeSwap) =>
    isEvmAsset(getRelevantAssetForSwap(swap));

export const getPreBridgeDetail = (
    bridge?: BridgeDetail,
): BridgeDetail | undefined =>
    bridge?.position === SwapPosition.Pre ? bridge : undefined;

export const getPostBridgeDetail = (
    bridge?: BridgeDetail,
): BridgeDetail | undefined =>
    bridge?.position === SwapPosition.Post ? bridge : undefined;

const generatePreimage = ({
    asset,
    keyIndex,
    rescueFile,
}: {
    asset: AssetType;
    keyIndex: number;
    rescueFile: RescueFile;
}) => {
    return derivePreimageFromRescueKey(rescueFile, keyIndex, asset);
};

export const createLocalSwapId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");

export const createCommitmentSwap = (
    assetSend: string,
    assetReceive: string,
    initialReceiveAsset: string,
    sourceAsset: string,
    sourceAmount: BigNumber,
    gasAbstraction: GasAbstraction,
    dex?: DexDetail,
    bridge?: BridgeDetail,
    originalDestination?: string,
): CommitmentSwap => {
    return {
        id: createLocalSwapId(),
        type: SwapType.Commitment,
        gasAbstraction,
        assetSend,
        assetReceive,
        date: new Date().getTime(),
        version: OutputType.Taproot,
        initialReceiveAsset,
        sourceAsset,
        sourceAmount: sourceAmount.toFixed(0),
        dex,
        bridge,
        originalDestination,
    };
};

export const createSubmarine = async (
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    invoice: string,
    pairHash: string,
    gasAbstraction: GasAbstraction,
    newKey: newKeyFn,
    originalDestination?: string,
    metadata?: string,
): Promise<SubmarineSwap> => {
    const key = await newKey(assetSend as AssetType);
    const res = await createSubmarineSwap(
        assetSend,
        assetReceive,
        invoice,
        pairHash,
        key !== undefined
            ? Buffer.from(key.key.publicKey).toString("hex")
            : undefined,
        metadata,
    );

    return {
        ...annotateSwapBaseData(
            res,
            SwapType.Submarine,
            assetSend,
            assetReceive,
            sendAmount,
            receiveAmount,
            gasAbstraction,
        ),
        invoice,
        originalDestination,
        refundPrivateKeyIndex: key?.index,
    };
};

export const createReverse = async (
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    claimAddress: string,
    pairHash: string,
    gasAbstraction: GasAbstraction,
    rescueFile: RescueFile,
    newKey: newKeyFn,
    originalDestination?: string,
    metadata?: string,
): Promise<ReverseSwap> => {
    const key = await newKey(assetReceive as AssetType);
    const preimage = generatePreimage({
        asset: assetReceive as AssetType,
        keyIndex: key?.index,
        rescueFile,
    });

    const res = await createReverseSwap(
        assetSend,
        assetReceive,
        Number(sendAmount),
        hex.encode(sha256(preimage)),
        pairHash,
        key !== undefined
            ? Buffer.from(key.key.publicKey).toString("hex")
            : undefined,
        claimAddress,
        metadata,
    );

    return {
        ...annotateSwapBaseData(
            res,
            SwapType.Reverse,
            assetSend,
            assetReceive,
            sendAmount,
            receiveAmount,
            gasAbstraction,
        ),
        claimAddress,
        originalDestination,
        preimage: hex.encode(preimage),
        claimPrivateKeyIndex: key?.index,
    };
};

export const createChain = async (
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    claimAddress: string,
    pairHash: string,
    gasAbstraction: GasAbstraction,
    rescueFile: RescueFile,
    newKey: newKeyFn,
    originalDestination?: string,
    metadata?: string,
): Promise<ChainSwap> => {
    const claimKey = await newKey(assetReceive as AssetType);
    const refundKey = await newKey(assetSend as AssetType);
    const preimage = generatePreimage({
        asset: assetReceive as AssetType,
        keyIndex: claimKey?.index,
        rescueFile,
    });
    const res = await createChainSwap(
        assetSend,
        assetReceive,
        sendAmount.isZero() || sendAmount.isNaN()
            ? undefined
            : Number(sendAmount),
        hex.encode(sha256(preimage)),
        claimKey !== undefined
            ? Buffer.from(claimKey.key.publicKey).toString("hex")
            : undefined,
        refundKey !== undefined
            ? Buffer.from(refundKey.key.publicKey).toString("hex")
            : undefined,
        claimAddress,
        pairHash,
        metadata,
    );

    return {
        ...annotateSwapBaseData(
            res,
            SwapType.Chain,
            assetSend,
            assetReceive,
            sendAmount,
            receiveAmount,
            gasAbstraction,
        ),
        claimAddress,
        originalDestination,
        preimage: hex.encode(preimage),
        claimPrivateKeyIndex: claimKey?.index,
        refundPrivateKeyIndex: refundKey?.index,
    };
};

const annotateSwapBaseData = <T, K extends SwapType>(
    createdResponse: T,
    type: K,
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    gasAbstraction: GasAbstraction,
): T & SwapBase & { type: K } => ({
    ...createdResponse,
    type,
    gasAbstraction,
    assetSend,
    assetReceive,
    date: new Date().getTime(),
    version: OutputType.Taproot,
    sendAmount: Number(sendAmount),
    receiveAmount: Number(receiveAmount),
});
