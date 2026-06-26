import { hex } from "@scure/base";
import {
    OutputType,
    type RefundDetails,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import { Buffer } from "buffer";
import type { networks as LiquidNetworks } from "liquidjs-lib";

import { getPartialRefundSignature } from "../client.ts";
import { formatError } from "../errors.ts";
import { getLogger } from "../logger.ts";
import { SwapType } from "../types.ts";
import type { UtxoAsset } from "./claim.ts";
import { utxoSecp } from "./lazy.ts";
import {
    type ECKeys,
    LBTC,
    createMusig,
    hashForWitnessV1,
    tweakMusig,
} from "./musig.ts";
import {
    type UtxoNetwork,
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setCooperativeWitness,
    txToHex,
    txToId,
} from "./transaction.ts";

type LiquidNetwork = (typeof LiquidNetworks)["liquid"];

type SerializedSwapTree = Parameters<
    typeof SwapTreeSerializer.deserializeSwapTree
>[0];

export type RefundSubmarineUtxoParams = {
    id: string;
    asset: UtxoAsset;
    network: UtxoNetwork;
    swapTree: SerializedSwapTree;
    claimPublicKey: string;
    refundKeys: ECKeys;
    lockupTxHex: string;
    refundAddress: string;
    blindingKey?: string;
    feePerVbyte: number;
    timeoutBlockHeight: number;
    cooperative?: boolean;
};

export type RefundLockup = {
    lockupTxHex: string;
    timeoutBlockHeight: number;
};

export type RefundUtxosParams = {
    id: string;
    swapType: SwapType;
    asset: UtxoAsset;
    network: UtxoNetwork;
    swapTree: SerializedSwapTree;
    claimPublicKey: string;
    refundKeys: ECKeys;
    lockups: RefundLockup[];
    refundAddress: string;
    blindingKey?: string;
    feePerVbyte: number;
    // Single nLockTime for the whole uncooperative refund; the caller resolves
    // it from the per-lockup timeouts (e.g. their maximum).
    nLockTime: number;
    cooperative?: boolean;
};

export type RefundResult = {
    transactionHex: string;
    transactionId: string;
    cooperativeError?: string;
};

export const refundUtxos = async (
    params: RefundUtxosParams,
): Promise<RefundResult> => {
    const cooperative = params.cooperative ?? true;
    const { asset, network } = params;

    // Ensure secp256k1-zkp is initialized for Liquid transaction construction.
    if (asset === LBTC) {
        await utxoSecp.get();
    }

    const boltzPublicKey = hex.decode(params.claimPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(params.swapTree);
    const keyAgg = createMusig(params.refundKeys, boltzPublicKey);
    const tweaked = tweakMusig(asset, keyAgg, tree.tree);

    const blindingPrivateKey =
        params.blindingKey !== undefined
            ? Buffer.from(params.blindingKey, "hex")
            : undefined;

    const getTx = getTransaction(asset);
    const details = params.lockups.map((lockup) => {
        const lockupTx = getTx.fromHex(lockup.lockupTxHex);
        const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);
        if (swapOutput === undefined) {
            throw new Error("could not find swap output in lockup transaction");
        }
        return {
            ...swapOutput,
            cooperative,
            swapTree: tree,
            privateKey: params.refundKeys.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey,
            internalKey: keyAgg.aggPubkey,
        };
    }) as unknown as (RefundDetails & { blindingPrivateKey?: Uint8Array })[];

    const decoded = decodeAddress(asset, params.refundAddress, network);
    const constructRefund = getConstructRefundTransaction(
        asset,
        asset === LBTC && decoded.blindingKey === undefined,
    );
    const refundTx = constructRefund(
        details,
        decoded.script,
        cooperative ? 0 : params.nLockTime,
        params.feePerVbyte,
        true,
        asset === LBTC
            ? (getNetwork(asset, network) as LiquidNetwork)
            : undefined,
        decoded.blindingKey,
    );

    if (!cooperative) {
        return {
            transactionHex: txToHex(refundTx),
            transactionId: txToId(refundTx),
        };
    }

    try {
        // One input per lockup detail; sign each cooperatively in its own
        // musig session.
        for (let index = 0; index < details.length; index++) {
            const inputKeyAgg = createMusig(params.refundKeys, boltzPublicKey);
            const inputTweaked = tweakMusig(asset, inputKeyAgg, tree.tree);

            const sigHash = hashForWitnessV1(
                asset,
                getNetwork(asset, network),
                details,
                refundTx,
                index,
            );

            const withNonce = inputTweaked.message(sigHash).generateNonce();

            const boltzSig = await getPartialRefundSignature(
                params.id,
                params.swapType,
                withNonce.publicNonce,
                txToHex(refundTx),
                index,
            );

            const aggNonces = withNonce.aggregateNonces([
                [boltzPublicKey, boltzSig.pubNonce],
            ]);
            const session = aggNonces.initializeSession();
            const signed = session.signPartial();
            const withBoltz = signed.addPartial(
                boltzPublicKey,
                boltzSig.signature,
            );

            setCooperativeWitness(
                refundTx,
                index,
                withBoltz.aggregatePartials(),
            );
        }

        return {
            transactionHex: txToHex(refundTx),
            transactionId: txToId(refundTx),
        };
    } catch (e) {
        getLogger().warn("Uncooperative refund because", e);
        const fallback = await refundUtxos({ ...params, cooperative: false });
        return { ...fallback, cooperativeError: formatError(e) };
    }
};

export const refundSubmarineUtxo = async (
    params: RefundSubmarineUtxoParams,
): Promise<RefundResult> => {
    const { transactionHex, transactionId } = await refundUtxos({
        id: params.id,
        swapType: SwapType.Submarine,
        asset: params.asset,
        network: params.network,
        swapTree: params.swapTree,
        claimPublicKey: params.claimPublicKey,
        refundKeys: params.refundKeys,
        lockups: [
            {
                lockupTxHex: params.lockupTxHex,
                timeoutBlockHeight: params.timeoutBlockHeight,
            },
        ],
        refundAddress: params.refundAddress,
        blindingKey: params.blindingKey,
        feePerVbyte: params.feePerVbyte,
        nLockTime: params.timeoutBlockHeight,
        cooperative: params.cooperative,
    });
    return { transactionHex, transactionId };
};
