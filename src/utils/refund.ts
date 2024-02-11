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

import { LBTC } from "../consts";
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
import { createMusig, hashForWitnessV1, tweakMusig } from "./taproot/musig";

export const refundJsonKeys = ["id", "asset", "privateKey"];
export const refundJsonKeysLiquid = refundJsonKeys.concat("blindingKey");

const refundTaproot = async (
    swap: any,
    lockupTx: TransactionInterface,
    privateKey: ECPairInterface,
    decodedAddress: DecodedAddress,
    fees: number,
) => {
    const boltzPublicKey = Buffer.from(swap.claimPublicKey, "hex");
    const musig = createMusig(privateKey, boltzPublicKey);
    const tree = SwapTreeSerializer.deserializeSwapTree(swap.swapTree);
    const tweakedKey = tweakMusig(swap.asset, musig, tree.tree);

    const swapOutput = detectSwap(tweakedKey, lockupTx);

    const details = [
        {
            ...swapOutput,
            keys: privateKey,
            cooperative: true,
            type: OutputType.Taproot,
            txHash: lockupTx.getHash(),
            blindingPrivateKey: parseBlindingKey(swap),
        } as RefundDetails & LiquidRefundDetails,
    ];

    const constructRefundTransaction = getConstructRefundTransaction(
        swap.asset,
    );
    const claimTx = constructRefundTransaction(
        details,
        decodedAddress.script,
        0,
        fees,
        true,
        getNetwork(swap.asset) as LiquidNetwork,
        decodedAddress.blindingKey,
    );

    const boltzSig = await getPartialRefundSignature(
        swap.asset,
        swap.id,
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
};

export async function refund(
    swap: any,
    refundAddress: string,
    transactionToRefund: { hex: string; timeoutBlockHeight: number },
) {
    log.debug("starting to refund swap", swap);

    const assetName = swap.asset;

    let output: DecodedAddress;
    output = decodeAddress(assetName, refundAddress);
    log.info("refunding swap: ", swap.id);
    await setup();

    const resFees = await getFeeEstimations(assetName);
    const fees = resFees[swap.asset];

    const Transaction = getTransaction(assetName);
    const tx = Transaction.fromHex(transactionToRefund.hex);
    const privateKey = parsePrivateKey(swap.privateKey);

    let refundTransaction: TransactionInterface;

    if (swap.version === OutputType.Taproot) {
        refundTransaction = await refundTaproot(
            swap,
            tx,
            privateKey,
            output,
            fees,
        );
    } else {
        const redeemScript = Buffer.from(swap.redeemScript, "hex");
        log.debug("redeemScript", redeemScript);
        const swapOutput = detectSwap(redeemScript, tx);
        log.debug("swapOutput", swapOutput);

        const constructRefundTransaction =
            getConstructRefundTransaction(assetName);
        refundTransaction = constructRefundTransaction(
            [
                {
                    ...swapOutput,
                    txHash: tx.getHash(),
                    redeemScript: redeemScript,
                    keys: privateKey,
                    blindingPrivateKey: parseBlindingKey(swap),
                } as RefundDetails & LiquidRefundDetails,
            ],
            output.script,
            transactionToRefund.timeoutBlockHeight,
            fees,
            true, // rbf
            assetName === LBTC
                ? (getNetwork(assetName) as LiquidNetwork)
                : undefined,
            output.blindingKey,
        );
    }

    log.debug("refundTransaction", refundTransaction.toHex());

    const res = await broadcastTransaction(
        assetName,
        refundTransaction.toHex(),
    );
    log.debug("refund result:", res);
    if (res.id) {
        swap.refundTx = res.id;
    }
    return swap;
}
