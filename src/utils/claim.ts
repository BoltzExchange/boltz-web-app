import { crypto } from "bitcoinjs-lib";
import type { ClaimDetails } from "boltz-core";
import { OutputType, SwapTreeSerializer, detectSwap } from "boltz-core";
import type { LiquidClaimDetails } from "boltz-core/dist/lib/liquid";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { LBTC, RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import type { RescueFile } from "../utils/rescueFile";
import { deriveKey } from "../utils/rescueFile";
import type { TransactionInterface } from "./boltzClient";
import {
    broadcastTransaction,
    getChainSwapClaimDetails,
    getPartialReverseClaimSignature,
    getSubmarineClaimDetails,
    postChainSwapDetails,
    postSubmarineClaimDetails,
} from "./boltzClient";
import {
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
} from "./compat";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import { decodeInvoice } from "./invoice";
import type { ChainSwap, ReverseSwap, SubmarineSwap } from "./swapCreator";
import { getRelevantAssetForSwap } from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

const createAdjustedClaim = async <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Buffer })
        | LiquidClaimDetails,
>(
    swap: ReverseSwap | ChainSwap,
    claimDetails: T[],
    destination: Buffer,
    liquidNetwork?: LiquidNetwork,
    blindingKey?: Buffer,
) => {
    if (swap.receiveAmount === 0) {
        throw "amount to be received is 0";
    }

    const asset = getRelevantAssetForSwap(swap);

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
        swap.claimPrivateKeyIndex,
        swap.claimPrivateKey,
    );
    const preimage = Buffer.from(swap.preimage, "hex");

    const decodedAddress = decodeAddress(asset, swap.claimAddress);
    const boltzPublicKey = Buffer.from(swap.refundPublicKey, "hex");
    const musig = await createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusig(asset, musig, tree.tree);
    const swapOutput = detectSwap(tweakedKey, lockupTx);

    if (swapOutput === undefined) {
        throw new Error("Swap output is undefined");
    }

    const details = [
        {
            ...swapOutput,
            cooperative,
            swapTree: tree,
            keys: privateKey,
            preimage: preimage,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap, false),
            internalKey: musig.getAggregatedPublicKey(),
        },
    ] as (ClaimDetails & { blindingPrivateKey: Buffer })[];
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
        const boltzSig = await getPartialReverseClaimSignature(
            swap.id,
            preimage,
            Buffer.from(musig.getPublicNonce()),
            claimTx,
            0,
        );

        musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
        musig.initializeSession(
            hashForWitnessV1(asset, getNetwork(asset), details, claimTx, 0),
        );
        musig.signPartial();
        musig.addPartial(boltzPublicKey, boltzSig.signature);

        claimTx.ins[0].witness = [musig.aggregatePartials()];

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

        const boltzClaimPublicKey = Buffer.from(
            serverClaimDetails.publicKey,
            "hex",
        );
        const theirClaimMusig = await createMusig(
            parsePrivateKey(
                deriveKey,
                swap.refundPrivateKeyIndex,
                swap.refundPrivateKey,
            ),
            boltzClaimPublicKey,
        );
        tweakMusig(
            swap.assetSend,
            theirClaimMusig,
            SwapTreeSerializer.deserializeSwapTree(swap.lockupDetails.swapTree)
                .tree,
        );
        theirClaimMusig.aggregateNonces([
            [
                boltzClaimPublicKey,
                Buffer.from(serverClaimDetails.pubNonce, "hex"),
            ],
        ]);
        theirClaimMusig.initializeSession(
            Buffer.from(serverClaimDetails.transactionHash, "hex"),
        );

        return {
            pubNonce: Buffer.from(theirClaimMusig.getPublicNonce()).toString(
                "hex",
            ),
            partialSignature: Buffer.from(
                theirClaimMusig.signPartial(),
            ).toString("hex"),
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
    const boltzRefundPublicKey = Buffer.from(
        swap.claimDetails.serverPublicKey,
        "hex",
    );
    const claimPrivateKey = parsePrivateKey(
        deriveKey,
        swap.claimPrivateKeyIndex,
        swap.claimPrivateKey,
    );
    const ourClaimMusig = await createMusig(
        claimPrivateKey,
        boltzRefundPublicKey,
    );
    const claimTree = SwapTreeSerializer.deserializeSwapTree(
        swap.claimDetails.swapTree,
    );
    const tweakedKey = tweakMusig(
        swap.assetReceive,
        ourClaimMusig,
        claimTree.tree,
    );

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            cooperative: cooperative,
            swapTree: claimTree,
            keys: claimPrivateKey,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap, false),
            internalKey: ourClaimMusig.getAggregatedPublicKey(),
            preimage: Buffer.from(swap.preimage, "hex"),
        },
    ] as (ClaimDetails & { blindingPrivateKey: Buffer })[];
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
        // Post our partial signature to ask for theirs
        const theirPartial = await postChainSwapDetails(
            swap.id,
            swap.preimage,
            await createTheirPartialChainSwapSignature(deriveKey, swap),
            {
                index: 0,
                transaction: claimTx.toHex(),
                pubNonce: Buffer.from(ourClaimMusig.getPublicNonce()).toString(
                    "hex",
                ),
            },
        );

        ourClaimMusig.aggregateNonces([
            [boltzRefundPublicKey, Buffer.from(theirPartial.pubNonce, "hex")],
        ]);
        ourClaimMusig.initializeSession(
            hashForWitnessV1(
                swap.assetReceive,
                getNetwork(swap.assetReceive),
                details,
                claimTx,
                0,
            ),
        );
        ourClaimMusig.addPartial(
            boltzRefundPublicKey,
            Buffer.from(theirPartial.partialSignature, "hex"),
        );
        ourClaimMusig.signPartial();

        claimTx.ins[0].witness = [ourClaimMusig.aggregatePartials()];

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
    externalBroadcast: boolean,
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
    const res = await broadcastTransaction(
        asset,
        claimTransaction.toHex(),
        externalBroadcast,
    );
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
        crypto.sha256(claimDetails.preimage).toString("hex") !==
        (await decodeInvoice(swap.invoice)).preimageHash
    ) {
        throw "invalid preimage";
    }

    const boltzPublicKey = Buffer.from(swap.claimPublicKey, "hex");
    const musig = await createMusig(
        parsePrivateKey(
            deriveKey,
            swap.refundPrivateKeyIndex,
            swap.refundPrivateKey,
        ),
        boltzPublicKey,
    );
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    tweakMusig(swapAsset, musig, tree.tree);

    musig.aggregateNonces([[boltzPublicKey, claimDetails.pubNonce]]);
    musig.initializeSession(claimDetails.transactionHash);

    await postSubmarineClaimDetails(
        swap.id,
        musig.getPublicNonce(),
        musig.signPartial(),
    );
};

export const derivePreimageFromRescueKey = (
    rescueKey: RescueFile,
    keyIndex: number,
): Buffer => {
    const privateKey = deriveKey(rescueKey, keyIndex).privateKey;

    return crypto.sha256(Buffer.from(privateKey));
};
