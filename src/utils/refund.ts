import { detectSwap } from "boltz-core";
import log from "loglevel";

import {
    decodeAddress,
    getConstructRefundTransaction,
    getNetwork,
    getTransaction,
    setup,
} from "../compat";
import { LBTC } from "../consts";
import { ECPair } from "../ecpair/ecpair";
import { fetcher, getApiUrl, parseBlindingKey } from "../helper";
import t from "../i18n";
import {
    setNotification,
    setNotificationType,
    setRefundTx,
    setSwap,
    setSwaps,
    swaps,
} from "../signals";
import { swapStatusFailed } from "./swapStatus";

const refundErrorResponseHandler = (error: any) => {
    console.log(error);
    setNotificationType("error");
    if (typeof error.json === "function") {
        error
            .json()
            .then((jsonError: any) => {
                let msg = jsonError.error;
                if (
                    msg === "bad-txns-inputs-missingorspent" ||
                    msg === "Transaction already in block chain"
                ) {
                    msg = t("already_refunded");
                } else if (msg === "mandatory-script-verify-flag-failed") {
                    msg = t("locktime_not_satisfied");
                }
                setNotification(msg);
            })
            .catch((genericError: any) => {
                log.debug("generic error", genericError);
                log.error(genericError);
                setNotification(error.statusText);
            });
    } else {
        setNotification(error.message);
    }
};

export async function getfeeestimation(asset: string) {
    return new Promise((resolve) => {
        fetcher(getApiUrl("/getfeeestimation", asset), (data) => {
            log.debug("getfeeestimation: ", data);
            resolve(data[asset]);
        });
    });
}

export async function refund(
    swap: any,
    refundAddress: string,
    txHex: string,
    timeoutBlockHeight: number,
) {
    let output: any;

    setRefundTx("");

    log.debug("starting to refund swap", swap);

    const asset_name = swap.asset;

    try {
        output = decodeAddress(asset_name, refundAddress);
    } catch (e) {
        log.error(e);
        setNotificationType("error");
        setNotification("invalid address");
        return false;
    }
    log.info("refunding swap: ", swap.id);
    let [_, fees] = await Promise.all([setup(), getfeeestimation(swap.asset)]);

    const Transaction = getTransaction(asset_name);
    const net = getNetwork(asset_name);
    const assetHash = asset_name === LBTC ? net.assetHash : undefined;

    let tx = Transaction.fromHex(txHex);
    let script = Buffer.from(swap.redeemScript, "hex");
    log.debug("script", script);
    let swapOutput = detectSwap(script, tx);
    log.debug("swapoutput", swapOutput);
    let private_key = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    log.debug("privkey", private_key);

    const constructRefundTransaction =
        getConstructRefundTransaction(asset_name);

    // TODO: fix, @michael1011?
    // missing some keys for TransactionOutput?
    const refundTransaction = constructRefundTransaction(
        // @ts-ignore
        [
            {
                ...swapOutput,
                txHash: tx.getHash(),
                redeemScript: script,
                keys: private_key,
                blindingPrivateKey: parseBlindingKey(swap),
            },
        ],
        output.script,
        timeoutBlockHeight,
        fees,
        true, // rbf
        assetHash,
        output.blindingKey,
    ).toHex();

    log.debug("refund_tx", refundTransaction);
    fetcher(
        getApiUrl("/broadcasttransaction", swap.asset),
        (data: any) => {
            log.debug("refund result:", data);
            if (data.transactionId) {
                // save refundTx into swaps json and set it to the current swap
                // only if the swaps was not initiated with the refund json
                // refundjson has no date
                if (swap.date !== undefined) {
                    const tmpSwaps = swaps();
                    const currentSwap = tmpSwaps.find((s) => s.id === swap.id);
                    currentSwap.refundTx = data.transactionId;
                    currentSwap.status = swapStatusFailed.SwapRefunded;
                    setSwaps(tmpSwaps);
                    setSwap(currentSwap);
                    log.debug("current_swap", currentSwap);
                    log.debug("swaps", tmpSwaps);
                }

                setRefundTx(data.transactionId);
                setNotificationType("success");
                setNotification(t("broadcasted"));
            }
        },
        {
            currency: asset_name,
            transactionHex: refundTransaction,
        },
        refundErrorResponseHandler,
    );
    return true;
}
