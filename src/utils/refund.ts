import {
    OutputType,
    RefundDetails,
    SwapTreeSerializer,
    detectSwap,
} from "boltz-core";
import { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import { Buffer } from "buffer";
import { ECPairInterface } from "ecpair";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";

import { LBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import {
    TransactionInterface,
    broadcastTransaction,
    getFeeEstimations,
    getPartialRefundSignature,
} from "./boltzClient";
import {
    DecodedAddress,
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setup,
} from "./compat";
import { parseBlindingKey, parsePrivateKey } from "./helper";
import { ChainSwap, SubmarineSwap } from "./swapCreator";
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

const refundTaproot = async (
    swap: SubmarineSwap | ChainSwap,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    decodedAddress: DecodedAddress,
    feesPerVbyte: number,
) => {
    const theirPublicKey =
        swap.type === SwapType.Submarine
            ? (swap as SubmarineSwap).claimPublicKey
            : (swap as ChainSwap).lockupDetails.serverPublicKey;
    const lockupTree =
        swap.type === SwapType.Submarine
            ? (swap as SubmarineSwap).swapTree
            : (swap as ChainSwap).lockupDetails.swapTree;

    const boltzPublicKey = Buffer.from(theirPublicKey, "hex");
    const musig = createMusig(privateKey, boltzPublicKey);
    const tweakedKey = tweakMusig(
        swap.assetSend,
        musig,
        SwapTreeSerializer.deserializeSwapTree(lockupTree).tree,
    );

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            keys: privateKey,
            cooperative: true,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap, true),
        } as RefundDetails & LiquidRefundDetails,
    ];

    const constructRefundTransaction = getConstructRefundTransaction(
        swap.assetSend,
        swap.assetSend === LBTC && decodedAddress.blindingKey === undefined,
    );
    const claimTx = constructRefundTransaction(
        details,
        decodedAddress.script,
        0,
        feesPerVbyte,
        true,
        getNetwork(swap.assetSend) as LiquidNetwork,
        decodedAddress.blindingKey,
    );

    const boltzSig = await getPartialRefundSignature(
        swap.assetSend,
        swap.id,
        swap.type,
        Buffer.from(musig.getPublicNonce()),
        claimTx,
        0,
    );
    musig.aggregateNonces([[boltzPublicKey, boltzSig.pubNonce]]);
    musig.initializeSession(
        hashForWitnessV1(
            swap.assetSend,
            getNetwork(swap.assetSend),
            details,
            claimTx,
            0,
        ),
    );
    musig.signPartial();
    musig.addPartial(boltzPublicKey, boltzSig.signature);

    claimTx.ins[0].witness = [musig.aggregatePartials()];

    return claimTx;
};

export const refund = async (
    swap: SubmarineSwap | ChainSwap,
    refundAddress: string,
    transactionToRefund: { hex: string; timeoutBlockHeight: number },
) => {
    log.debug("starting to refund swap", swap);

    await setup();
    log.info("refunding swap: ", swap.id);

    const output = decodeAddress(swap.assetSend, refundAddress);

    const feePerVbyte = (await getFeeEstimations(swap.assetSend))[
        swap.assetSend
    ];

    const lockupTransaction = getTransaction(swap.assetSend).fromHex(
        transactionToRefund.hex,
    );
    const privateKey = parsePrivateKey(swap.refundPrivateKey);

    let refundTransaction: TransactionInterface;

    if (swap.version === OutputType.Taproot) {
        refundTransaction = await refundTaproot(
            swap,
            lockupTransaction,
            privateKey,
            output,
            feePerVbyte,
        );
    } else {
        const redeemScript = Buffer.from((swap as any).redeemScript, "hex");
        log.debug("redeemScript", redeemScript);
        const swapOutput = detectSwap(redeemScript, lockupTransaction);
        log.debug("swapOutput", swapOutput);

        const constructRefundTransaction = getConstructRefundTransaction(
            swap.assetSend,
            swap.assetSend === LBTC && output.blindingKey === undefined,
        );
        refundTransaction = constructRefundTransaction(
            [
                {
                    ...swapOutput,
                    txHash: lockupTransaction.getHash(),
                    redeemScript: redeemScript,
                    keys: privateKey,
                    blindingPrivateKey: parseBlindingKey(swap, true),
                } as RefundDetails & LiquidRefundDetails,
            ],
            output.script,
            transactionToRefund.timeoutBlockHeight,
            feePerVbyte,
            true,
            swap.assetSend === LBTC
                ? (getNetwork(swap.assetReceive) as LiquidNetwork)
                : undefined,
            output.blindingKey,
        );
    }
    const res = await broadcastTransaction(
        swap.assetSend,
        refundTransaction.toHex(),
    );
    log.debug("refund result:", res);
    if (res.id) {
        swap.refundTx = res.id;
    }
    return swap;
};
