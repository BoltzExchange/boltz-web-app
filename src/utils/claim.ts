import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import type { ClaimDetails } from "boltz-core";
import { OutputType, SwapTreeSerializer, detectSwap } from "boltz-core";
import type { LiquidClaimDetails } from "boltz-core/dist/lib/liquid";
import { type Buffer } from "buffer";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { type AssetType, LBTC, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import secp from "../lazy/secp";
import {
    broadcastTransaction,
    getChainSwapClaimDetails,
    getPartialReverseClaimSignature,
    getSubmarineClaimDetails,
    postChainSwapDetails,
    postSubmarineClaimDetails,
} from "./boltzClient";
import type { TransactionInterface } from "./compat";
import {
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setCooperativeWitness,
    txToHex,
    txToId,
} from "./compat";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import { decodeInvoice } from "./invoice";
import type { ChainSwap, ReverseSwap, SubmarineSwap } from "./swapCreator";
import { getRelevantAssetForSwap } from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

const createAdjustedClaim = async <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Uint8Array })
        | LiquidClaimDetails,
>(
    swap: ReverseSwap | ChainSwap,
    claimDetails: T[],
    destination: Uint8Array,
    liquidNetwork?: LiquidNetwork,
    blindingKey?: Buffer,
) => {
    if (swap.receiveAmount === 0) {
        throw "amount to be received is 0";
    }

    const asset = getRelevantAssetForSwap(swap);

    // Ensure secp256k1-zkp is initialized for Liquid transaction construction
    if (asset === LBTC) {
        await secp.get();
    }

    let inputSum = 0;
    for (const details of claimDetails) {
        inputSum += await getOutputAmount(asset, details);
    }

    const feeBudget = Math.floor(inputSum - swap.receiveAmount);

    const constructClaimTransaction = getConstructClaimTransaction(asset);

    return constructClaimTransaction(
        claimDetails as ClaimDetails[] | LiquidClaimDetails[],
        destination,
        feeBudget,
        true,
        liquidNetwork,
        blindingKey,
    );
};

const claimReverseSwap = async (
    deriveKey: deriveKeyFn,
    swap: ReverseSwap,
    lockupTx: TransactionInterface,
    cooperative: boolean = true,
): Promise<TransactionInterface | undefined> => {
    log.info(`Claiming Taproot swap cooperatively: ${cooperative}`);
    const asset = getRelevantAssetForSwap(swap);

    const privateKey = parsePrivateKey(
        deriveKey,
        swap.assetReceive as AssetType,
        swap.claimPrivateKeyIndex,
        swap.claimPrivateKey,
    );
    const preimage = hex.decode(swap.preimage);

    const decodedAddress = decodeAddress(asset, swap.claimAddress);
    const boltzPublicKey = hex.decode(swap.refundPublicKey);
    const keyAgg = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweaked = tweakMusig(asset, keyAgg, tree.tree);
    const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);

    if (swapOutput === undefined) {
        throw new Error("Swap output is undefined");
    }

    const details = [
        {
            ...swapOutput,
            cooperative,
            swapTree: tree,
            privateKey: privateKey.privateKey,
            preimage: preimage,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey: parseBlindingKey(swap, false),
            internalKey: keyAgg.aggPubkey,
        },
    ] as unknown as (ClaimDetails & { blindingPrivateKey: Uint8Array })[];
    const claimTx = await createAdjustedClaim(
        swap,
        details,
        decodedAddress.script,
        asset === LBTC ? (getNetwork(asset) as LiquidNetwork) : undefined,
        decodedAddress.blindingKey,
    );

    if (!cooperative) {
        return claimTx;
    }

    try {
        const sigHash = hashForWitnessV1(
            asset,
            getNetwork(asset),
            details,
            claimTx,
            0,
        );

        const withMsg = tweaked.message(sigHash);
        const withNonce = withMsg.generateNonce();

        const boltzSig = await getPartialReverseClaimSignature(
            swap.id,
            preimage,
            withNonce.publicNonce,
            claimTx,
            0,
        );

        const aggNonces = withNonce.aggregateNonces([
            [boltzPublicKey, boltzSig.pubNonce],
        ]);
        const session = aggNonces.initializeSession();
        const signed = session.signPartial();
        const withBoltz = signed.addPartial(boltzPublicKey, boltzSig.signature);

        setCooperativeWitness(claimTx, 0, withBoltz.aggregatePartials());

        return claimTx;
    } catch (e) {
        log.warn("Uncooperative Taproot claim because", e);
        return claimReverseSwap(deriveKey, swap, lockupTx, false);
    }
};

export const createTheirPartialChainSwapSignature = async (
    deriveKey: deriveKeyFn,
    swap: ChainSwap,
): Promise<Awaited<ReturnType<typeof postChainSwapDetails>> | undefined> => {
    // RSK claim transactions can't be signed cooperatively
    if (swap.assetSend === RBTC) {
        return undefined;
    }

    // Sign the claim transaction of the server
    try {
        const serverClaimDetails = await getChainSwapClaimDetails(swap.id);

        const boltzClaimPublicKey = hex.decode(serverClaimDetails.publicKey);
        const theirClaimKeyAgg = createMusig(
            parsePrivateKey(
                deriveKey,
                swap.assetSend as AssetType,
                swap.refundPrivateKeyIndex,
                swap.refundPrivateKey,
            ),
            boltzClaimPublicKey,
        );
        const tweaked = tweakMusig(
            swap.assetSend,
            theirClaimKeyAgg,
            SwapTreeSerializer.deserializeSwapTree(swap.lockupDetails.swapTree)
                .tree,
        );

        const withMsg = tweaked.message(
            hex.decode(serverClaimDetails.transactionHash),
        );
        const withNonce = withMsg.generateNonce();

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
        if (err === "swap not eligible for a cooperative claim") {
            log.debug(
                `Backend already broadcast their claim for chain swap ${swap.id}`,
            );
            return undefined;
        }

        throw err;
    }
};

const claimChainSwap = async (
    deriveKey: deriveKeyFn,
    swap: ChainSwap,
    lockupTx: TransactionInterface,
    cooperative = true,
): Promise<TransactionInterface> => {
    log.info(`Claiming Chain swap cooperatively: ${cooperative}`);
    const boltzRefundPublicKey = hex.decode(swap.claimDetails.serverPublicKey);
    const claimPrivateKey = parsePrivateKey(
        deriveKey,
        swap.assetReceive as AssetType,
        swap.claimPrivateKeyIndex,
        swap.claimPrivateKey,
    );
    const ourClaimKeyAgg = createMusig(claimPrivateKey, boltzRefundPublicKey);
    const claimTree = SwapTreeSerializer.deserializeSwapTree(
        swap.claimDetails.swapTree,
    );
    const tweaked = tweakMusig(
        swap.assetReceive,
        ourClaimKeyAgg,
        claimTree.tree,
    );

    const swapOutput = detectSwap(tweaked.aggPubkey, lockupTx);

    const details = [
        {
            ...swapOutput,
            cooperative: cooperative,
            swapTree: claimTree,
            privateKey: claimPrivateKey.privateKey,
            type: OutputType.Taproot,
            transactionId: txToId(lockupTx),
            blindingPrivateKey: parseBlindingKey(swap, false),
            internalKey: ourClaimKeyAgg.aggPubkey,
            preimage: hex.decode(swap.preimage),
        },
    ] as unknown as (ClaimDetails & { blindingPrivateKey: Uint8Array })[];
    const decodedAddress = decodeAddress(swap.assetReceive, swap.claimAddress);
    const claimTx = await createAdjustedClaim(
        swap,
        details,
        decodedAddress.script,
        swap.assetReceive === LBTC
            ? (getNetwork(swap.assetReceive) as LiquidNetwork)
            : undefined,
        decodedAddress.blindingKey,
    );

    if (!cooperative) {
        return claimTx;
    }

    try {
        const sigHash = hashForWitnessV1(
            swap.assetReceive,
            getNetwork(swap.assetReceive),
            details,
            claimTx,
            0,
        );

        const withMsg = tweaked.message(sigHash);
        const withNonce = withMsg.generateNonce();

        // Post our partial signature to ask for theirs
        const theirPartial = await postChainSwapDetails(
            swap.id,
            swap.preimage,
            await createTheirPartialChainSwapSignature(deriveKey, swap),
            {
                index: 0,
                transaction: txToHex(claimTx),
                pubNonce: hex.encode(withNonce.publicNonce),
            },
        );

        const aggNonces = withNonce.aggregateNonces([
            [boltzRefundPublicKey, hex.decode(theirPartial.pubNonce)],
        ]);
        const session = aggNonces.initializeSession();
        const withTheirs = session.addPartial(
            boltzRefundPublicKey,
            hex.decode(theirPartial.partialSignature),
        );
        const signed = withTheirs.signPartial();

        setCooperativeWitness(claimTx, 0, signed.aggregatePartials());

        return claimTx;
    } catch (e) {
        log.warn("Uncooperative Taproot claim because", e);
        return claimChainSwap(deriveKey, swap, lockupTx, false);
    }
};

export const claim = async <T extends ReverseSwap | ChainSwap>(
    deriveKey: deriveKeyFn,
    swap: T,
    swapStatusTransaction: { hex: string },
    cooperative: boolean,
): Promise<T | undefined> => {
    const asset = getRelevantAssetForSwap(swap);
    if (asset === RBTC) {
        return undefined;
    }

    const lockupTx = getTransaction(swap.assetReceive).fromHex(
        swapStatusTransaction.hex,
    );

    let claimTransaction: TransactionInterface;
    if (swap.type === SwapType.Reverse) {
        claimTransaction = await claimReverseSwap(
            deriveKey,
            swap as ReverseSwap,
            lockupTx,
            cooperative,
        );
    } else {
        claimTransaction = await claimChainSwap(
            deriveKey,
            swap as ChainSwap,
            lockupTx,
            cooperative,
        );
    }

    log.debug("Broadcasting claim transaction");
    const res = await broadcastTransaction(asset, txToHex(claimTransaction));
    log.debug("Claim transaction broadcast result", res);

    if (res.id) {
        swap.claimTx = res.id;
    }

    return swap;
};

export const createSubmarineSignature = async (
    deriveKey: deriveKeyFn,
    swap: SubmarineSwap,
) => {
    const swapAsset = getRelevantAssetForSwap(swap);
    if (swapAsset === RBTC) {
        return;
    }

    log.info("Creating cooperative claim signature for", swap.id);

    const claimDetails = await getSubmarineClaimDetails(swap.id);
    if (
        hex.encode(sha256(claimDetails.preimage)) !==
        (await decodeInvoice(swap.invoice)).preimageHash
    ) {
        throw "invalid preimage";
    }

    const boltzPublicKey = hex.decode(swap.claimPublicKey);
    const keyAgg = createMusig(
        parsePrivateKey(
            deriveKey,
            swap.assetSend as AssetType,
            swap.refundPrivateKeyIndex,
            swap.refundPrivateKey,
        ),
        boltzPublicKey,
    );
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweaked = tweakMusig(swapAsset, keyAgg, tree.tree);

    const withMsg = tweaked.message(claimDetails.transactionHash);
    const withNonce = withMsg.generateNonce();

    const aggNonces = withNonce.aggregateNonces([
        [boltzPublicKey, claimDetails.pubNonce],
    ]);
    const session = aggNonces.initializeSession();
    const signed = session.signPartial();

    await postSubmarineClaimDetails(
        swap.id,
        withNonce.publicNonce,
        signed.ourPartialSignature,
    );
};
