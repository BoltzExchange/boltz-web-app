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
    getPartialReverseClaimSignature,
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
import { fetcher, parseBlindingKey, parsePrivateKey } from "./helper";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

const createAdjustedClaim = <
    T extends
        | (ClaimDetails & { blindingPrivateKey?: Buffer })
        | LiquidClaimDetails,
>(
    swap: any,
    claimDetails: T[],
    destination: Buffer,
    liquidNetwork?: LiquidNetwork,
    blindingKey?: Buffer,
) => {
    const inputSum = claimDetails.reduce(
        (total: number, input: T) => total + getOutputAmount(swap.asset, input),
        0,
    );
    const feeBudget = Math.floor(inputSum - swap.receiveAmount);

    const constructClaimTransaction = getConstructClaimTransaction(swap.asset);
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
    swap: any,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    preimage: Buffer,
    decodedAddress: DecodedAddress,
    cooperative = true,
) => {
    log.info(`Claiming Taproot swap cooperatively: ${cooperative}`);

    const boltzPublicKey = Buffer.from(swap.refundPublicKey, "hex");
    const musig = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusig(swap.asset, musig, tree.tree);

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
        swap.asset === LBTC
            ? (getNetwork(swap.asset) as LiquidNetwork)
            : undefined,
        decodedAddress.blindingKey,
    );

    if (!cooperative) {
        return claimTx;
    }

    try {
        const boltzSig = await getPartialReverseClaimSignature(
            swap.asset,
            swap.id,
            preimage,
            Buffer.from(musig.getPublicNonce()),
            claimTx,
            0,
        );

        musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
        musig.initializeSession(
            hashForWitnessV1(
                swap.asset,
                getNetwork(swap.asset),
                details,
                claimTx,
                0,
            ),
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
    swap: any,
    swapStatusTransaction: { hex: string },
) => {
    if (swap.asset === RBTC) {
        return;
    }

    await setup();
    const assetName = swap.asset;

    log.info("claiming swap: ", swap.id);
    if (!swapStatusTransaction) {
        return log.debug("no swapStatusTransaction tx found");
    }
    if (!swapStatusTransaction.hex) {
        return log.debug("swapStatusTransaction tx hex not found");
    }
    log.debug("swapStatusTransaction", swapStatusTransaction.hex);

    const Transaction = getTransaction(assetName);

    const tx = Transaction.fromHex(swapStatusTransaction.hex);

    const privateKey = parsePrivateKey(swap.privateKey);
    log.debug("privateKey: ", privateKey);

    const preimage = Buffer.from(swap.preimage, "hex");
    log.debug("preimage: ", preimage);

    const decodedAddress = decodeAddress(assetName, swap.onchainAddress);

    let claimTransaction: TransactionInterface;

    if (swap.version === OutputType.Taproot) {
        claimTransaction = await claimTaproot(
            swap,
            tx,
            privateKey,
            preimage,
            decodedAddress,
        );
    } else {
        const redeemScript = Buffer.from(swap.redeemScript, "hex");
        const swapOutput = detectSwap(redeemScript, tx);
        claimTransaction = createAdjustedClaim(
            swap,
            [
                {
                    ...swapOutput,
                    redeemScript,
                    txHash: tx.getHash(),
                    preimage: preimage,
                    keys: privateKey,
                    blindingPrivateKey: parseBlindingKey(swap),
                },
            ],
            decodedAddress.script,
            assetName === LBTC
                ? (getNetwork(assetName) as LiquidNetwork)
                : undefined,
            decodedAddress.blindingKey,
        );
    }

    log.debug("claim_tx", claimTransaction);
    const res = await fetcher("/broadcasttransaction", assetName, {
        currency: assetName,
        transactionHex: claimTransaction.toHex(),
    });
    log.debug("claim result:", res);
    if (res.transactionId) {
        swap.claimTx = res.transactionId;
    }
    return swap;
};
