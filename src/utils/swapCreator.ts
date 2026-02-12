import type BigNumber from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { randomBytes } from "crypto";

import { LN, isEvmAsset } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { newKeyFn } from "../context/Global";
import { type EncodedHop, HopsPosition } from "./Pair";
import type {
    ChainSwapCreatedResponse,
    Pairs,
    ReverseCreatedResponse,
    SubmarineCreatedResponse,
} from "./boltzClient";
import {
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
} from "./boltzClient";
import { derivePreimageFromRescueKey } from "./claim";
import { getPair } from "./helper";
import type { RescueFile } from "./rescueFile";

export type DexDetail = {
    hops: EncodedHop[];

    // Whether hops run before or after the Boltz swap
    position: HopsPosition;

    // Expected DEX amount at creation; updated with actual amount after execution.
    // For hops after Boltz: expected output amount from the DEX.
    // For hops before Boltz: expected input amount to the DEX.
    quoteAmount: number;
};

export type SwapBase = {
    type: SwapType;
    status?: string;
    assetSend: string;
    assetReceive: string;
    sendAmount: number;
    receiveAmount: number;
    version: number;
    date: number;

    // Not set for submarine swaps; but set for interface compatibility
    claimTx?: string;
    lockupTx?: string;

    useGasAbstraction: boolean;
    signer?: string;
    // Set for hardware wallet signers
    derivationPath?: string;

    // Original user input (Lightning address/LNURL/BIP353/BOLT12) before resolution
    originalDestination?: string;

    // DEX route for routed swaps (e.g. USDT0 via TBTC).
    dex?: DexDetail;
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
    if (swap.dex !== undefined && swap.dex.position === HopsPosition.Before) {
        return swap.dex.hops[0].from;
    }

    return coalesceLn && swap.type === SwapType.Reverse ? LN : swap.assetSend;
};

export const getFinalAssetReceive = (
    swap: SwapBase,
    coalesceLn: boolean = false,
): string => {
    if (swap.dex !== undefined && swap.dex.position === HopsPosition.After) {
        return swap.dex.hops[swap.dex.hops.length - 1].to;
    }

    return coalesceLn && swap.type === SwapType.Submarine
        ? LN
        : swap.assetReceive;
};

export const isEvmSwap = (swap: SomeSwap) =>
    isEvmAsset(getRelevantAssetForSwap(swap));

const generatePreimage = ({
    isEvm,
    keyIndex,
    rescueFile,
}: {
    isEvm: boolean;
    keyIndex: number;
    rescueFile: RescueFile;
}) => {
    if (isEvm) {
        return randomBytes(32);
    }
    return derivePreimageFromRescueKey(rescueFile, keyIndex);
};

export const createSubmarine = async (
    pairs: Pairs,
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    invoice: string,
    referralId: string,
    useGasAbstraction: boolean,
    newKey: newKeyFn,
    originalDestination?: string,
): Promise<SubmarineSwap> => {
    const isEvm = isEvmAsset(assetReceive);
    const key = !isEvm ? newKey() : undefined;
    const res = await createSubmarineSwap(
        assetSend,
        assetReceive,
        invoice,
        getPair(pairs, SwapType.Submarine, assetSend, assetReceive).hash,
        referralId,
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
            useGasAbstraction,
        ),
        invoice,
        originalDestination,
        refundPrivateKeyIndex: key?.index,
    };
};

export const createReverse = async (
    pairs: Pairs,
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    claimAddress: string,
    referralId: string,
    useGasAbstraction: boolean,
    rescueFile: RescueFile,
    newKey: newKeyFn,
    originalDestination?: string,
): Promise<ReverseSwap> => {
    const isEvm = isEvmAsset(assetReceive);

    const key = !isEvm ? newKey() : undefined;
    const preimage = generatePreimage({
        isEvm,
        keyIndex: key?.index,
        rescueFile,
    });

    const res = await createReverseSwap(
        assetSend,
        assetReceive,
        Number(sendAmount),
        crypto.sha256(preimage).toString("hex"),
        getPair(pairs, SwapType.Reverse, assetSend, assetReceive).hash,
        referralId,
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
            useGasAbstraction,
        ),
        claimAddress,
        originalDestination,
        preimage: preimage.toString("hex"),
        claimPrivateKeyIndex: key?.index,
    };
};

export const createChain = async (
    pairs: Pairs,
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    claimAddress: string,
    referralId: string,
    useGasAbstraction: boolean,
    rescueFile: RescueFile,
    newKey: newKeyFn,
    originalDestination?: string,
): Promise<ChainSwap> => {
    const claimKey = !isEvmAsset(assetReceive) ? newKey() : undefined;
    const refundKey = !isEvmAsset(assetSend) ? newKey() : undefined;
    const isEvm = isEvmAsset(assetReceive) || isEvmAsset(assetSend);
    const preimage = generatePreimage({
        isEvm,
        keyIndex: claimKey?.index,
        rescueFile,
    });
    const res = await createChainSwap(
        assetSend,
        assetReceive,
        sendAmount.isZero() || sendAmount.isNaN()
            ? undefined
            : Number(sendAmount),
        crypto.sha256(preimage).toString("hex"),
        claimKey !== undefined
            ? Buffer.from(claimKey.key.publicKey).toString("hex")
            : undefined,
        refundKey !== undefined
            ? Buffer.from(refundKey.key.publicKey).toString("hex")
            : undefined,
        claimAddress,
        getPair(pairs, SwapType.Chain, assetSend, assetReceive).hash,
        referralId,
    );

    return {
        ...annotateSwapBaseData(
            res,
            SwapType.Chain,
            assetSend,
            assetReceive,
            sendAmount,
            receiveAmount,
            useGasAbstraction,
        ),
        claimAddress,
        originalDestination,
        preimage: preimage.toString("hex"),
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
    useGasAbstraction: boolean,
): T & SwapBase => ({
    ...createdResponse,
    type,
    useGasAbstraction,
    assetSend,
    assetReceive,
    date: new Date().getTime(),
    version: OutputType.Taproot,
    sendAmount: Number(sendAmount),
    receiveAmount: Number(receiveAmount),
});
