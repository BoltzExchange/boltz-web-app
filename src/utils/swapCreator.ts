import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import type BigNumber from "bignumber.js";
import { OutputType } from "boltz-core";

import { type AssetType } from "../consts/Assets";
import { LN, isEvmAsset } from "../consts/Assets";
import { SwapPosition, SwapType } from "../consts/Enums";
import type { newKeyFn } from "../context/Global";
import type { EncodedHop } from "./Pair";
import type {
    ChainSwapCreatedResponse,
    ReverseCreatedResponse,
    SubmarineCreatedResponse,
} from "./boltzClient";
import {
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
} from "./boltzClient";
import { type RescueFile, derivePreimageFromRescueKey } from "./rescueFile";

export type DexDetail = {
    hops: EncodedHop[];

    // Whether hops run pre or post the Boltz swap
    position: SwapPosition;

    // Expected DEX amount at creation; updated with actual amount after execution.
    // For post-swap hops: expected output amount from the DEX.
    // For pre-swap hops: expected input amount to the DEX.
    quoteAmount: number | string;
};

export type OftStageDetail = {
    sourceAsset: string;
    destinationAsset: string;
};

export type OftDetail = OftStageDetail & {
    position: SwapPosition;
    txHash?: string;
};

export const enum GasAbstractionType {
    None = "none",
    RifRelay = "rifRelay",
    Signer = "signer",
}

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

export type SwapBase = {
    type: SwapType;
    status?: string;
    assetSend: string;
    assetReceive: string;
    getGasToken?: boolean;
    sendAmount: number;
    receiveAmount: number;
    version: number;
    date: number;

    // Not set for submarine swaps; but set for interface compatibility
    claimTx?: string;
    refundTx?: string;
    lockupTx?: string;
    commitmentLockupTxHash?: string;
    commitmentLockupCallId?: string;
    commitmentSignatureSubmitted?: boolean;

    gasAbstraction: GasAbstraction;
    signer?: string;
    // Set for hardware wallet signers
    derivationPath?: string;

    // Original user input (Lightning address/LNURL/BIP353/BOLT12) before resolution
    originalDestination?: string;

    // DEX route for routed swaps (e.g. USDT0 via TBTC).
    dex?: DexDetail;

    // OFT routes for bridging before lockup or after claim.
    oft?: OftDetail;
};

export type SubmarineSwap = SwapBase &
    SubmarineCreatedResponse & {
        invoice: string;
        preimage?: string;
        refundPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility
        refundPrivateKey?: string;
    };

export type ReverseSwap = SwapBase &
    ReverseCreatedResponse & {
        preimage: string;
        claimAddress: string;
        claimPrivateKeyIndex?: number;

        // Deprecated; used for backwards compatibility
        claimPrivateKey?: string;
    };

export type ChainSwap = SwapBase &
    ChainSwapCreatedResponse & {
        preimage: string;
        claimAddress: string;
        claimPrivateKeyIndex?: number;
        refundPrivateKeyIndex?: number;
        magicRoutingHintSavedFees?: string;

        // Deprecated; used for backwards compatibility
        claimPrivateKey?: string;
        refundPrivateKey?: string;
    };

export type SomeSwap = SubmarineSwap | ReverseSwap | ChainSwap;

export const getLockupGasAbstraction = (swap: SwapBase): GasAbstractionType =>
    swap.gasAbstraction.lockup;

export const getClaimGasAbstraction = (swap: SwapBase): GasAbstractionType =>
    swap.gasAbstraction.claim;

export const getRelevantAssetForSwap = (swap: SwapBase) => {
    switch (swap.type) {
        case SwapType.Submarine:
            return swap.assetSend;

        default:
            return swap.assetReceive;
    }
};

export const getFinalAssetSend = (
    swap: SwapBase,
    coalesceLn: boolean = false,
): string => {
    if (swap.oft?.position === SwapPosition.Pre) {
        return swap.oft.sourceAsset;
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
    swap: SwapBase,
    coalesceLn: boolean = false,
): string => {
    if (swap.oft?.position === SwapPosition.Post) {
        return swap.oft.destinationAsset;
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

export const getPreOftDetail = (oft?: OftDetail): OftDetail | undefined =>
    oft?.position === SwapPosition.Pre ? oft : undefined;

export const getPostOftDetail = (oft?: OftDetail): OftDetail | undefined =>
    oft?.position === SwapPosition.Post ? oft : undefined;

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

const annotateSwapBaseData = <T>(
    createdResponse: T,
    type: SwapType,
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    gasAbstraction: GasAbstraction,
): T & SwapBase => ({
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
