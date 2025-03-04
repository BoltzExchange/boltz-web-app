import BigNumber from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { randomBytes } from "crypto";

import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { newKeyFn } from "../context/Global";
import {
    ChainSwapCreatedResponse,
    Pairs,
    ReverseCreatedResponse,
    SubmarineCreatedResponse,
    createChainSwap,
    createReverseSwap,
    createSubmarineSwap,
} from "./boltzClient";
import { getPair } from "./helper";

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

    refundTx?: string;
    lockupTx?: string;

    useRif: boolean;
    signer?: string;
    // Set for hardware wallet signers
    derivationPath?: string;
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

export const createSubmarine = async (
    pairs: Pairs,
    assetSend: string,
    assetReceive: string,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    invoice: string,
    referralId: string,
    useRif: boolean,
    newKey: newKeyFn,
): Promise<SubmarineSwap> => {
    const isRsk = assetReceive === RBTC;
    const key = !isRsk ? newKey() : undefined;
    const res = await createSubmarineSwap(
        assetSend,
        assetReceive,
        invoice,
        getPair(pairs, SwapType.Submarine, assetSend, assetReceive).hash,
        referralId,
        key?.key.publicKey.toString("hex"),
    );

    return {
        ...annotateSwapBaseData(
            res,
            SwapType.Submarine,
            assetSend,
            assetReceive,
            sendAmount,
            receiveAmount,
            useRif,
        ),
        invoice,
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
    useRif: boolean,
    newKey: newKeyFn,
): Promise<ReverseSwap> => {
    const isRsk = assetReceive === RBTC;

    const preimage = randomBytes(32);
    const key = !isRsk ? newKey() : undefined;

    const res = await createReverseSwap(
        assetSend,
        assetReceive,
        Number(sendAmount),
        crypto.sha256(preimage).toString("hex"),
        getPair(pairs, SwapType.Reverse, assetSend, assetReceive).hash,
        referralId,
        key?.key.publicKey.toString("hex"),
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
            useRif,
        ),
        claimAddress,
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
    useRif: boolean,
    newKey: newKeyFn,
): Promise<ChainSwap> => {
    const preimage = randomBytes(32);
    const claimKey = assetReceive !== RBTC ? newKey() : undefined;
    const refundKey = assetSend !== RBTC ? newKey() : undefined;

    const res = await createChainSwap(
        assetSend,
        assetReceive,
        sendAmount.isZero() || sendAmount.isNaN()
            ? undefined
            : Number(sendAmount),
        crypto.sha256(preimage).toString("hex"),
        claimKey?.key.publicKey.toString("hex"),
        refundKey?.key.publicKey.toString("hex"),
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
            useRif,
        ),
        claimAddress,
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
    useRif: boolean,
): T & SwapBase => ({
    ...createdResponse,
    type,
    useRif,
    assetSend,
    assetReceive,
    date: new Date().getTime(),
    version: OutputType.Taproot,
    sendAmount: Number(sendAmount),
    receiveAmount: Number(receiveAmount),
});
