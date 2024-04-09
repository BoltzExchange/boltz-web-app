import { crypto } from "bitcoinjs-lib";
import {
    ClaimDetails,
    OutputType,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import { LiquidClaimDetails } from "boltz-core/dist/lib/liquid";
import { ECPairInterface } from "ecpair";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { LBTC, RBTC } from "../consts";
import {
    TransactionInterface,
    broadcastTransaction,
    getPartialReverseClaimSignature,
    getSubmarineClaimDetails,
    postSubmarineClaimDetails,
} from "./boltzClient";
import {
    DecodedAddress,
    decodeAddress,
    getConstructClaimTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setup,
} from "./compat";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import { decodeInvoice } from "./invoice";
import {
    ReverseSwap,
    SubmarineSwap,
    getRelevantAssetForSwap,
} from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

const createAdjustedClaim = <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Buffer })
        | LiquidClaimDetails,
>(
    swap: ReverseSwap,
    claimDetails: T[],
    destination: Buffer,
    liquidNetwork?: LiquidNetwork,
    blindingKey?: Buffer,
) => {
    const asset = getRelevantAssetForSwap(swap);
    const inputSum = claimDetails.reduce(
        (total: number, input: T) => total + getOutputAmount(asset, input),
        0,
    );
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

const claimTaproot = async (
    swap: ReverseSwap,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    preimage: Buffer,
    decodedAddress: DecodedAddress,
    cooperative = true,
) => {
    log.info(`Claiming Taproot swap cooperatively: ${cooperative}`);
    const asset = getRelevantAssetForSwap(swap);

    const boltzPublicKey = Buffer.from(swap.refundPublicKey, "hex");
    const musig = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusig(asset, musig, tree.tree);

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            cooperative,
            swapTree: tree,
            keys: privateKey,
            preimage: preimage,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap),
            internalKey: musig.getAggregatedPublicKey(),
        },
    ] as (ClaimDetails & { blindingPrivateKey: Buffer })[];
    const claimTx = createAdjustedClaim(
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
            asset,
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
        return claimTaproot(
            swap,
            lockupTx,
            privateKey,
            preimage,
            decodedAddress,
            false,
        );
    }
};

export const claim = async (
    swap: ReverseSwap,
    swapStatusTransaction: { hex: string },
) => {
    const asset = getRelevantAssetForSwap(swap);

    if (asset === RBTC) {
        return;
    }

    await setup();
    log.info("claiming swap: ", swap.id);
    if (!swapStatusTransaction) {
        return log.debug("no swapStatusTransaction tx found");
    }
    if (!swapStatusTransaction.hex) {
        return log.debug("swapStatusTransaction tx hex not found");
    }
    log.debug("swapStatusTransaction", swapStatusTransaction.hex);

    const Transaction = getTransaction(asset);

    const tx = Transaction.fromHex(swapStatusTransaction.hex);

    const privateKey = parsePrivateKey(swap.claimPrivateKey);
    log.debug("privateKey: ", swap.claimPrivateKey);

    const preimage = Buffer.from(swap.preimage, "hex");
    log.debug("preimage: ", swap.preimage);

    const decodedAddress = decodeAddress(asset, swap.claimAddress);

    let claimTransaction = await claimTaproot(
        swap,
        tx,
        privateKey,
        preimage,
        decodedAddress,
    );

    log.debug("claim_tx", claimTransaction);

    const res = await broadcastTransaction(asset, claimTransaction.toHex());
    log.debug("claim result:", res);

    if (res.id) {
        swap.claimTx = res.id;
    }
    return swap;
};

export const createSubmarineSignature = async (swap: SubmarineSwap) => {
    const swapAsset = getRelevantAssetForSwap(swap);
    if (swapAsset === RBTC) {
        return;
    }

    await setup();
    log.info(`creating cooperative claim signature for`, swap.id);

    const claimDetails = await getSubmarineClaimDetails(swapAsset, swap.id);
    if (
        crypto.sha256(claimDetails.preimage).toString("hex") !==
        decodeInvoice(swap.invoice).preimageHash
    ) {
        throw "invalid preimage";
    }

    const boltzPublicKey = Buffer.from(swap.claimPublicKey, "hex");
    const musig = createMusig(
        parsePrivateKey(swap.refundPrivateKey),
        boltzPublicKey,
    );
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    tweakMusig(swapAsset, musig, tree.tree);

    musig.aggregateNonces([[boltzPublicKey, claimDetails.pubNonce]]);
    musig.initializeSession(claimDetails.transactionHash);

    await postSubmarineClaimDetails(
        swapAsset,
        swap.id,
        musig.getPublicNonce(),
        musig.signPartial(),
    );
};
