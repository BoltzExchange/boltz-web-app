import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import {
    type ClaimDetails,
    type Musig,
    OutputType,
    SwapTreeSerializer,
    type Types,
    detectSwap,
} from "boltz-core";
import type { LiquidClaimDetails } from "boltz-core/liquid";
import {
    getChainSwapTransactions,
    getPartialReverseClaimSignature,
    getReverseTransaction,
    getSubmarineClaimDetails,
    postSubmarineClaimDetails,
} from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import {
    type LiquidTransactionOutputWithKey,
    type PartialSignatureResponse,
    type TransactionInterface,
    type UtxoAsset,
    type UtxoNetwork,
    claimChainSwapUtxo,
    createCooperativeSourceClaimSignature,
    createMusig,
    getConstructClaimTransaction,
    getOutputAmount,
    getTransaction,
    hashForWitnessV1,
    setCooperativeWitness,
    tweakMusig,
    txToHex,
    txToId,
} from "boltz-swaps/utxo";
import type { Buffer } from "buffer";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { config } from "../config";
import { type AssetType, LBTC, RBTC, isEvmAsset } from "../consts/Assets";
import type { deriveKeyFn } from "../context/Global";
import secp from "../lazy/secp";
import { getClaimBlindingData } from "./blindedExplorer";
import { broadcastTransaction } from "./blockchain";
import { decodeAddress, getNetwork } from "./compat";
import type { ECKeys } from "./ecpair";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import { decodeInvoice } from "./invoice";
import {
    type ChainSwap,
    type ReverseSwap,
    type SomeSwap,
    type SubmarineSwap,
    getRelevantAssetForSwap,
} from "./swapCreator";

type ClaimableSwap = ReverseSwap | ChainSwap;

type ClaimTaprootContext = {
    privateKey: ECKeys;
    boltzPublicKey: Uint8Array;
    tree: Types.SwapTree;
    keyAgg: Musig.MusigKeyAgg;
    tweaked: Musig.MusigKeyAgg;
};

const getClaimTaprootContext = (
    deriveKey: deriveKeyFn,
    swap: ClaimableSwap,
): ClaimTaprootContext => {
    const privateKey = parsePrivateKey(
        deriveKey,
        swap.assetReceive as AssetType,
        swap.claimPrivateKeyIndex,
        swap.claimPrivateKey,
    );

    let boltzPublicKey: Uint8Array;
    let tree: ClaimTaprootContext["tree"];

    switch (swap.type) {
        case SwapType.Reverse: {
            if (swap.refundPublicKey === undefined) {
                throw new Error("missing refund public key for reverse swap");
            }
            boltzPublicKey = hex.decode(swap.refundPublicKey);
            tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
            break;
        }

        case SwapType.Chain: {
            boltzPublicKey = hex.decode(swap.claimDetails.serverPublicKey);
            tree = SwapTreeSerializer.deserializeSwapTree(
                swap.claimDetails.swapTree,
            );
            break;
        }
    }

    const keyAgg = createMusig(privateKey, boltzPublicKey);
    const tweaked = tweakMusig(swap.assetReceive, keyAgg, tree.tree);

    return {
        privateKey,
        boltzPublicKey,
        tree,
        keyAgg,
        tweaked,
    };
};

const findSwapOutput = (
    tweaked: ClaimTaprootContext["tweaked"],
    lockupTx: TransactionInterface,
) => detectSwap(tweaked.aggPubkey, lockupTx);

const createAdjustedClaim = async <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Uint8Array })
        | LiquidClaimDetails,
>(
    swap: ClaimableSwap,
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

    const { privateKey, boltzPublicKey, tree, keyAgg, tweaked } =
        getClaimTaprootContext(deriveKey, swap);
    const preimage = hex.decode(swap.preimage);

    const decodedAddress = decodeAddress(asset, swap.claimAddress);
    const swapOutput = findSwapOutput(tweaked, lockupTx);

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
            txToHex(claimTx),
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
): Promise<PartialSignatureResponse | undefined> => {
    // EVM claim transactions can't be signed cooperatively
    if (isEvmAsset(swap.assetSend)) {
        return undefined;
    }

    return await createCooperativeSourceClaimSignature(swap.id, {
        asset: swap.assetSend as UtxoAsset,
        refundKeys: parsePrivateKey(
            deriveKey,
            swap.assetSend as AssetType,
            swap.refundPrivateKeyIndex,
            swap.refundPrivateKey,
        ),
        sourceSwapTree: swap.lockupDetails.swapTree,
    });
};

const claimChainSwap = async (
    deriveKey: deriveKeyFn,
    swap: ChainSwap,
    lockupTx: TransactionInterface,
    cooperative = true,
): Promise<TransactionInterface> => {
    log.info(`Claiming Chain swap cooperatively: ${cooperative}`);

    const claimKeys = parsePrivateKey(
        deriveKey,
        swap.assetReceive as AssetType,
        swap.claimPrivateKeyIndex,
        swap.claimPrivateKey,
    );

    // Cooperatively co-sign the server's source claim only when the source is
    // a UTXO chain; EVM sources reveal the preimage on-chain instead.
    const cooperativeSource = !isEvmAsset(swap.assetSend)
        ? {
              asset: swap.assetSend as UtxoAsset,
              refundKeys: parsePrivateKey(
                  deriveKey,
                  swap.assetSend as AssetType,
                  swap.refundPrivateKeyIndex,
                  swap.refundPrivateKey,
              ),
              sourceSwapTree: swap.lockupDetails.swapTree,
          }
        : undefined;

    const result = await claimChainSwapUtxo({
        id: swap.id,
        asset: swap.assetReceive as UtxoAsset,
        network: config.network as UtxoNetwork,
        serverPublicKey: swap.claimDetails.serverPublicKey,
        swapTree: swap.claimDetails.swapTree,
        blindingKey: swap.claimDetails.blindingKey,
        claimKeys,
        preimage: hex.decode(swap.preimage),
        claimAddress: swap.claimAddress,
        receiveAmount: swap.receiveAmount,
        lockupTxHex: txToHex(lockupTx),
        cooperativeSource,
        cooperative,
    });

    return getTransaction(swap.assetReceive).fromHex(result.transactionHex);
};

export const findSwapOutputVout = (
    deriveKey: deriveKeyFn,
    swap: ClaimableSwap,
    lockupTx: TransactionInterface,
): number | undefined => {
    const { tweaked } = getClaimTaprootContext(deriveKey, swap);
    return findSwapOutput(tweaked, lockupTx)?.vout;
};

// Builds the Blockstream "#blinded=" fragment for a Liquid claim transaction on
// demand: it re-fetches the lockup output the claim spent and unblinds it with
// the swap's blinding key. Returns undefined for non-Liquid swaps, before the
// claim exists, or if anything required is missing.
export const getClaimTransactionBlindingData = async (
    deriveKey: deriveKeyFn,
    swap: SomeSwap,
): Promise<string | undefined> => {
    if (
        swap.assetReceive !== LBTC ||
        swap.claimTx === undefined ||
        (swap.type !== SwapType.Reverse && swap.type !== SwapType.Chain)
    ) {
        return undefined;
    }

    try {
        const claimableSwap = swap as ClaimableSwap;

        // The claim spends the server's lockup output: the reverse lockup for
        // reverse swaps, the server lockup leg for chain swaps. (The chain
        // userLock is the asset we sent, not the one we claim.)
        const lockupHex =
            swap.type === SwapType.Reverse
                ? (await getReverseTransaction(swap.id)).hex
                : (await getChainSwapTransactions(swap.id)).serverLock
                      .transaction.hex;
        if (lockupHex === undefined) {
            return undefined;
        }

        const lockupTx = getTransaction(swap.assetReceive).fromHex(lockupHex);
        const { tweaked } = getClaimTaprootContext(deriveKey, claimableSwap);
        const swapOutput = findSwapOutput(tweaked, lockupTx);
        if (swapOutput === undefined) {
            return undefined;
        }

        return getClaimBlindingData(swap.assetReceive, {
            ...swapOutput,
            blindingPrivateKey: parseBlindingKey(claimableSwap, false),
        } as unknown as LiquidTransactionOutputWithKey);
    } catch (e) {
        log.warn("Could not build claim unblinding data", e);
        return undefined;
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

    let claimTransaction: TransactionInterface | undefined;
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
    if (claimTransaction === undefined) {
        return undefined;
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
        decodeInvoice(swap.invoice).preimageHash
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
