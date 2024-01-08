import { RefundDetails, detectSwap } from "boltz-core";
import { LiquidRefundDetails } from "boltz-core/dist/lib/liquid";
import log from "loglevel";

import t from "../i18n";
import {
    DecodedAddress,
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setup,
} from "./compat";
import { ECPair } from "./ecpair";
import { fetcher, getfeeestimation, parseBlindingKey } from "./helper";

export const refundJsonKeys = ["id", "asset", "privateKey", "redeemScript"];
export const refundJsonKeysLiquid = refundJsonKeys.concat("blindingKey");

export async function refund(
    swap: any,
    refundAddress: string,
    callback: (swap: any, error?: string) => any,
    transactionToRefund?: any,
) {
    log.debug("starting to refund swap", swap);

    const assetName = swap.asset;

    let output: DecodedAddress;
    output = decodeAddress(assetName, refundAddress);
    log.info("refunding swap: ", swap.id);
    let [_, fees] = await Promise.all([setup(), getfeeestimation(swap)]);

    if (!transactionToRefund) {
        transactionToRefund = await new Promise((resolve, reject) => {
            fetcher(
                "/getswaptransaction",
                swap.asset,
                (res: any) => {
                    log.debug(`got swap transaction for ${swap.id}`);
                    resolve(res);
                },
                {
                    id: swap.id,
                },
                () => {
                    log.warn(`no swap transaction for: ${swap.id}`);
                    reject();
                },
            );
        });
    }

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
        fees,
        true, // rbf
        assetHash,
        output.blindingKey,
    ).toHex();

    log.debug("refund_tx", refundTransaction);
    fetcher(
        "/broadcasttransaction",
        assetName,
        (data: any) => {
            log.debug("refund result:", data);
            if (data.transactionId) {
                swap.refundTx = data.transactionId;
                callback(swap);
            }
        },
        {
            currency: assetName,
            transactionHex: refundTransaction,
        },
        (error) => {
            if (typeof error.json === "function") {
                error
                    .json()
                    .then((jsonError: any) => {
                        let msg = jsonError.error;
                        if (
                            msg === "bad-txns-inputs-missingorspent" ||
                            msg === "Transaction already in block chain" ||
                            msg.startsWith("insufficient fee")
                        ) {
                            msg = t("already_refunded");
                        } else if (
                            msg === "mandatory-script-verify-flag-failed"
                        ) {
                            msg = t("locktime_not_satisfied");
                        }
                        log.error(msg);
                        callback(null, msg);
                    })
                    .catch((genericError: any) => {
                        log.error(genericError);
                        callback(null, error.statusText);
                    });
            } else {
                log.error(error.message);
                callback(null, error.message);
            }
        },
    );
}
