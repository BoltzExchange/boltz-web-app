import { hex } from "@scure/base";
import {
    type ClaimDetails,
    OutputType,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import { Buffer } from "buffer";
import type { networks as LiquidNetworks } from "liquidjs-lib";

import { getChainSwapClaimDetails, postChainSwapDetails } from "../client.ts";
import { formatError } from "../errors.ts";
import { getLogger } from "../logger.ts";
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
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setCooperativeWitness,
    txToHex,
    txToId,
} from "./transaction.ts";

type LiquidNetwork = (typeof LiquidNetworks)["liquid"];

export type UtxoAsset = "BTC" | "L-BTC";

type SerializedSwapTree = Parameters<
    typeof SwapTreeSerializer.deserializeSwapTree
>[0];

export type PartialSignatureResponse = {
    pubNonce: string;
    partialSignature: string;
};

export type CooperativeSourceClaimInput = {
    asset: UtxoAsset;
    refundKeys: ECKeys;
    sourceSwapTree: SerializedSwapTree;
};

export type ChainSwapUtxoClaimParams = {
    id: string;
    asset: UtxoAsset;
    network: UtxoNetwork;
    serverPublicKey: string;
    swapTree: SerializedSwapTree;
    blindingKey?: string;
    claimKeys: ECKeys;
    preimage: Uint8Array;
    claimAddress: string;
    receiveAmount: number;
    lockupTxHex: string;
    cooperativeSource?: CooperativeSourceClaimInput;
    cooperative?: boolean;
};

export type ChainSwapUtxoClaimResult = {
    transactionHex: string;
    transactionId: string;
};

const isNotEligibleForCooperativeClaim = (err: unknown): boolean =>
    formatError(err) === "swap not eligible for a cooperative claim";

export const createCooperativeSourceClaimSignature = async (
    id: string,
    input: CooperativeSourceClaimInput,
): Promise<PartialSignatureResponse | undefined> => {
    try {
        const serverClaimDetails = await getChainSwapClaimDetails(id);

        const boltzClaimPublicKey = hex.decode(serverClaimDetails.publicKey);
        const theirClaimKeyAgg = createMusig(
            input.refundKeys,
            boltzClaimPublicKey,
        );
        const tweaked = tweakMusig(
            input.asset,
            theirClaimKeyAgg,
            SwapTreeSerializer.deserializeSwapTree(input.sourceSwapTree).tree,
        );

        const withNonce = tweaked
            .message(hex.decode(serverClaimDetails.transactionHash))
            .generateNonce();

        const aggNonces = withNonce.aggregateNonces([
            [boltzClaimPublicKey, hex.decode(serverClaimDetails.pubNonce)],
        ]);
        const session = aggNonces.initializeSession();
        const signed = session.signPartial();

        return {
            pubNonce: hex.encode(withNonce.publicNonce),
            partialSignature: hex.encode(signed.ourPartialSignature),
        };
    } catch (err) {
        if (isNotEligibleForCooperativeClaim(err)) {
            getLogger().debug(
                `Backend already broadcast their claim for chain swap ${id}`,
            );
            return undefined;
        }
        throw err;
    }
};

export const claimChainSwapUtxo = async (
    params: ChainSwapUtxoClaimParams,
): Promise<ChainSwapUtxoClaimResult> => {
    const cooperative = params.cooperative ?? true;
    const { asset, network } = params;

    const boltzPublicKey = hex.decode(params.serverPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(params.swapTree);
    const keyAgg = createMusig(params.claimKeys, boltzPublicKey);
    const tweaked = tweakMusig(asset, keyAgg, tree.tree);

    const lockupTx = getTransaction(asset).fromHex(params.lockupTxHex);
    const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);
    if (swapOutput === undefined) {
        throw new Error("could not find swap output in lockup transaction");
    }

    const blindingPrivateKey =
        params.blindingKey !== undefined
            ? Buffer.from(params.blindingKey, "hex")
            : undefined;

    const details = [
        {
            ...swapOutput,
            cooperative,
            swapTree: tree,
            privateKey: params.claimKeys.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey,
            internalKey: keyAgg.aggPubkey,
            preimage: params.preimage,
        },
    ] as unknown as (ClaimDetails & { blindingPrivateKey?: Uint8Array })[];

    const decoded = decodeAddress(asset, params.claimAddress, network);
    const claimTx = await createAdjustedClaim(
        asset,
        params.receiveAmount,
        details,
        decoded.script,
        asset === LBTC
            ? (getNetwork(asset, network) as LiquidNetwork)
            : undefined,
        decoded.blindingKey,
    );

    if (!cooperative) {
        return {
            transactionHex: txToHex(claimTx),
            transactionId: txToId(claimTx),
        };
    }

    try {
        const sigHash = hashForWitnessV1(
            asset,
            getNetwork(asset, network),
            details,
            claimTx,
            0,
        );

        const withNonce = tweaked.message(sigHash).generateNonce();

        // For a UTXO source, also hand the server our partial signature so it
        // can claim the source cooperatively in the same request.
        const theirSig =
            params.cooperativeSource !== undefined
                ? await createCooperativeSourceClaimSignature(
                      params.id,
                      params.cooperativeSource,
                  )
                : undefined;

        const theirPartial = await postChainSwapDetails(
            params.id,
            hex.encode(params.preimage),
            theirSig,
            {
                index: 0,
                transaction: txToHex(claimTx),
                pubNonce: hex.encode(withNonce.publicNonce),
            },
        );

        const aggNonces = withNonce.aggregateNonces([
            [boltzPublicKey, hex.decode(theirPartial.pubNonce)],
        ]);
        const session = aggNonces.initializeSession();
        const withTheirs = session.addPartial(
            boltzPublicKey,
            hex.decode(theirPartial.partialSignature),
        );
        const signed = withTheirs.signPartial();

        setCooperativeWitness(claimTx, 0, signed.aggregatePartials());

        return {
            transactionHex: txToHex(claimTx),
            transactionId: txToId(claimTx),
        };
    } catch (e) {
        getLogger().warn("Uncooperative Taproot claim because", e);
        return claimChainSwapUtxo({ ...params, cooperative: false });
    }
};

const createAdjustedClaim = async (
    asset: string,
    receiveAmount: number,
    claimDetails: (ClaimDetails & { blindingPrivateKey?: Uint8Array })[],
    destination: Uint8Array,
    liquidNetwork?: LiquidNetwork,
    blindingKey?: Buffer,
) => {
    if (receiveAmount === 0) {
        throw new Error("amount to be received is 0");
    }

    // Ensure secp256k1-zkp is initialized for Liquid transaction construction.
    if (asset === LBTC) {
        await utxoSecp.get();
    }

    let inputSum = 0;
    for (const details of claimDetails) {
        inputSum += await getOutputAmount(asset, details as never);
    }

    const feeBudget = Math.floor(inputSum - receiveAmount);
    if (feeBudget < 0) {
        throw new Error(
            `cannot construct claim transaction: receiveAmount ${receiveAmount} exceeds available input sum ${inputSum}`,
        );
    }
    const constructClaimTransaction = getConstructClaimTransaction(asset);

    return constructClaimTransaction(
        claimDetails,
        destination,
        feeBudget,
        true,
        liquidNetwork,
        blindingKey,
    );
};
