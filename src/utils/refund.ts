import { RefundDetails, detectSwap } from "boltz-core";
import { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import log from "loglevel";

import {
    DecodedAddress,
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setup,
} from "./compat";
import { ECPair } from "./ecpair";
import { fetcher, parseBlindingKey } from "./helper";

export const refundJsonKeys = ["id", "asset", "privateKey", "redeemScript"];
export const refundJsonKeysLiquid = refundJsonKeys.concat("blindingKey");

export async function refund(
    swap: any,
    refundAddress: string,
    transactionToRefund: any,
) {
    log.debug("starting to refund swap", swap);

    const assetName = swap.asset;

    let output: DecodedAddress;
    output = decodeAddress(assetName, refundAddress);
    log.info("refunding swap: ", swap.id);
    await setup();
    const fees = await fetcher("/getfeeestimation", swap.asset);

    const Transaction = getTransaction(assetName);
    const constructRefundTransaction = getConstructRefundTransaction(assetName);
    const net = getNetwork(assetName);
    const assetHash = assetName === "L-BTC" ? net.assetHash : undefined;

    let tx = Transaction.fromHex(transactionToRefund.transactionHex);
    let script = Buffer.from(swap.redeemScript, "hex");
    log.debug("script", script);
    let swapOutput = detectSwap(script, tx);
    log.debug("swapoutput", swapOutput);
    let private_key = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    log.debug("privkey", private_key);
    const refundTransaction = constructRefundTransaction(
        [
            {
                ...swapOutput,
                txHash: tx.getHash(),
                redeemScript: script,
                keys: private_key,
                blindingPrivateKey: parseBlindingKey(swap),
            } as RefundDetails & LiquidRefundDetails,
        ],
        output.script,
        transactionToRefund.timeoutBlockHeight,
        fees[assetName],
        true, // rbf
        assetHash,
        output.blindingKey,
    ).toHex();

    log.debug("refund_tx", refundTransaction);
    const res = await fetcher("/broadcasttransaction", assetName, {
        currency: assetName,
        transactionHex: refundTransaction,
    });
    log.debug("refund result:", res);
    if (res.transactionId) {
        swap.refundTx = res.transactionId;
    }
    return swap;
}
