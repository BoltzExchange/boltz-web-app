import { detectSwap } from "boltz-core";
import { Buffer } from "buffer";
import log from "loglevel";

import {
    decodeAddress,
    getAddress,
    getConstructClaimTransaction,
    getConstructRefundTransaction,
    getNetwork,
    getOutputAmount,
    getTransaction,
    setup,
} from "./compat";
import { pairs } from "./config";
import { BTC, RBTC } from "./consts";
import { ECPair } from "./ecpair/ecpair";
import {
    asset,
    ref,
    refundAddress,
    setAsset,
    setConfig,
    setFailureReason,
    setNotification,
    setNotificationType,
    setOnline,
    setRef,
    setRefundAddress,
    setRefundTx,
    setSwap,
    setSwapStatus,
    setSwapStatusTransaction,
    setSwaps,
    setTimeoutBlockheight,
    setTimeoutEta,
    swap,
    swapStatusTransaction,
    swaps,
    transactionToRefund,
} from "./signals";
import { feeChecker } from "./utils/feeChecker";
import { checkResponse } from "./utils/http";
import { swapStatusPending, updateSwapStatus } from "./utils/swapStatus";

export const isIos = !!navigator.userAgent.match(/iphone|ipad/gi) || false;
export const isMobile =
    isIos || !!navigator.userAgent.match(/android|blackberry/gi) || false;

const parseBlindingKey = (swap) => {
    return swap.blindingKey ? Buffer.from(swap.blindingKey, "hex") : undefined;
};

export const cropString = (str) => {
    if (str.length < 40) {
        return str;
    }
    return str.substring(0, 19) + "..." + str.substring(str.length - 19);
};

export const checkReferralId = () => {
    const ref_param = new URLSearchParams(window.location.search).get("ref");
    if (ref_param && ref_param !== "") {
        setRef(ref_param);
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
        );
    }
};

export const startInterval = (cb, interval) => {
    cb();
    return setInterval(cb, interval);
};

export const clipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    setNotificationType("success");
    setNotification(message);
};

export const errorHandler = (error) => {
    log.error(error);
    setNotificationType("error");
    if (typeof error.json === "function") {
        error
            .json()
            .then((jsonError) => {
                setNotification(jsonError.error);
            })
            .catch((genericError) => {
                log.error(genericError);
                setNotification(error.statusText);
            });
    } else {
        setNotification(error.message);
    }
};

export const getApiUrl = (asset) => {
    const pair = pairs[`${asset}/BTC`];
    if (pair) {
        return pair.apiUrl;
    }

    log.error(`no pair found for ${asset}; falling back to ${BTC}`);
    return getApiUrl(BTC);
};

export const fetcher = (url, cb, params = null, errorCb = errorHandler) => {
    let opts = {};
    if (params) {
        params.referralId = ref();
        opts = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        };
    }
    const apiUrl = getApiUrl(asset()) + url;
    fetch(apiUrl, opts).then(checkResponse).then(cb).catch(errorCb);
};

export const checkForFailed = (swap, data) => {
    if (
        data.status == "transaction.lockupFailed" ||
        data.status == "invoice.failedToPay"
    ) {
        const id = swap.id;

        fetcher(
            "/getswaptransaction",
            (data) => {
                if (swap.asset !== RBTC && !data.transactionHex) {
                    log.error("no mempool tx found");
                }
                if (!data.timeoutEta) {
                    log.error("no timeout eta");
                }
                if (!data.timeoutBlockHeight) {
                    log.error("no timeout blockheight");
                }
                const timestamp = data.timeoutEta * 1000;
                const eta = new Date(timestamp);
                log.debug("Timeout ETA: \n " + eta.toLocaleString(), timestamp);
                setTimeoutEta(timestamp);
                setTimeoutBlockheight(data.timeoutBlockHeight);
            },
            {
                id,
            },
        );
    }
};

export const setSwapStatusAndClaim = (data, activeSwap) => {
    const currentSwap = swaps().find((s) => activeSwap.id === s.id);

    if (swap() && swap().id === currentSwap.id) {
        setSwapStatus(data.status);
    }

    setSwapStatusTransaction(data.transaction);
    updateSwapStatus(currentSwap.id, data.status);

    if (
        currentSwap.claimTx === undefined &&
        data.transaction !== undefined &&
        (data.status === swapStatusPending.TransactionConfirmed ||
            data.status === swapStatusPending.TransactionMempool)
    ) {
        claim(currentSwap);
    }
    checkForFailed(currentSwap, data);
    if (data.failureReason) setFailureReason(data.failureReason);
};

export async function refund(swap, t) {
    let output = "";
    setRefundTx("");

    log.debug("starting to refund swap", swap);

    const asset_name = swap.asset;

    try {
        output = decodeAddress(asset_name, refundAddress());
    } catch (e) {
        log.error(e);
        setNotificationType("error");
        setNotification("invalid address");
        return false;
    }
    log.info("refunding swap: ", swap.id);
    let [_, fees] = await Promise.all([setup(), getfeeestimation(swap)]);

    const txToRefund = transactionToRefund();
    const Transaction = getTransaction(asset_name);
    const constructRefundTransaction =
        getConstructRefundTransaction(asset_name);
    const net = getNetwork(asset_name);
    const assetHash = asset_name === "L-BTC" ? net.assetHash : undefined;

    let tx = Transaction.fromHex(txToRefund.transactionHex);
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
            },
        ],
        output.script,
        txToRefund.timeoutBlockHeight,
        fees,
        true, // rbf
        assetHash,
        output.blindingKey,
    ).toHex();

    log.debug("refund_tx", refundTransaction);
    fetcher(
        "/broadcasttransaction",
        (data) => {
            log.debug("refund result:", data);
            if (data.transactionId) {
                // save refundTx into swaps json and set it to the current swap
                // only if the swaps was not initiated with the refund json
                // refundjson has no date
                if (swap.date !== undefined) {
                    const tmpSwaps = swaps();
                    const currentSwap = tmpSwaps.find((s) => s.id === swap.id);
                    currentSwap.refundTx = data.transactionId;
                    setSwaps(tmpSwaps);
                    setSwap(currentSwap);
                    log.debug("current_swap", currentSwap);
                    log.debug("swaps", tmpSwaps);
                } else {
                    setRefundTx(data.transactionId);
                }

                setNotificationType("success");
                setNotification(t("broadcasted"));
            }
        },
        {
            currency: asset_name,
            transactionHex: refundTransaction,
        },
        (error) => {
            console.log(error);
            setNotificationType("error");
            if (typeof error.json === "function") {
                error
                    .json()
                    .then((jsonError) => {
                        let msg = jsonError.error;
                        if (
                            msg === "bad-txns-inputs-missingorspent" ||
                            msg === "Transaction already in block chain"
                        ) {
                            msg = t("already_refunded");
                        } else if (
                            msg === "mandatory-script-verify-flag-failed"
                        ) {
                            msg = t("locktime_not_satisfied");
                        }
                        setNotification(msg);
                    })
                    .catch((genericError) => {
                        log.debug("generic error", genericError);
                        log.error(genericError);
                        setNotification(error.statusText);
                    });
            } else {
                setNotification(error.message);
            }
        },
    );
}

export async function getfeeestimation(swap) {
    return new Promise((resolve) => {
        fetcher("/getfeeestimation", (data) => {
            log.debug("getfeeestimation: ", data);
            let asset = swap.asset;
            resolve(data[asset]);
        });
    });
}

const createAdjustedClaim = (
    swap,
    claimDetails,
    destination,
    assetHash,
    blindingKey,
) => {
    const inputSum = claimDetails.reduce(
        (total, input) => total + getOutputAmount(swap.asset, input),
        0,
    );
    const feeBudget = Math.floor(inputSum - swap.receiveAmount);

    const constructClaimTransaction = getConstructClaimTransaction(swap.asset);
    return constructClaimTransaction(
        claimDetails,
        destination,
        feeBudget,
        true,
        assetHash,
        blindingKey,
    );
};

export const claim = async (swap) => {
    if (swap.asset === RBTC) {
        return;
    }

    await setup();
    const asset_name = swap.asset;

    log.info("claiming swap: ", swap.id);
    let mempool_tx = swapStatusTransaction();
    if (!mempool_tx) {
        return log.debug("no mempool tx found");
    }
    if (!mempool_tx.hex) {
        return log.debug("mempool tx hex not found");
    }
    log.debug("mempool_tx", mempool_tx.hex);

    const Transaction = getTransaction(asset_name);
    const net = getNetwork(asset_name);
    const assetHash = asset_name === "L-BTC" ? net.assetHash : undefined;

    let tx = Transaction.fromHex(mempool_tx.hex);
    let redeemScript = Buffer.from(swap.redeemScript, "hex");

    let swapOutput = detectSwap(redeemScript, tx);
    let private_key = ECPair.fromPrivateKey(
        Buffer.from(swap.privateKey, "hex"),
    );
    log.debug("private_key: ", private_key);
    let preimage = Buffer.from(swap.preimage, "hex");
    log.debug("preimage: ", preimage);
    const { script, blindingKey } = decodeAddress(
        asset_name,
        swap.onchainAddress,
    );
    const claimTransaction = createAdjustedClaim(
        swap,
        [
            {
                ...swapOutput,
                redeemScript,
                txHash: tx.getHash(),
                preimage: preimage,
                keys: private_key,
                blindingPrivateKey: parseBlindingKey(swap),
            },
        ],
        script,
        assetHash,
        blindingKey,
    ).toHex();
    log.debug("claim_tx", claimTransaction);
    fetcher(
        "/broadcasttransaction",
        (data) => {
            log.debug("claim result:", data);
            if (data.transactionId) {
                const swapsTmp = swaps();
                const currentSwap = swapsTmp.find((s) => swap.id === s.id);
                currentSwap.claimTx = data.transactionId;
                setSwaps(swapsTmp);
            }
        },
        {
            currency: asset_name,
            transactionHex: claimTransaction,
        },
    );
};

export const fetchPairs = () => {
    fetcher(
        "/getpairs",
        (data) => {
            log.debug("getpairs", data);
            setOnline(true);
            setConfig(data.pairs);
        },
        null,
        (error) => {
            log.debug(error);
            setOnline(false);
        },
    );
    return false;
};

export const feeCheck = async (notification) => {
    return new Promise((resolve) => {
        fetcher(
            "/getpairs",
            (data) => {
                log.debug("getpairs", data);
                if (feeChecker(data.pairs)) {
                    // amounts matches and fees are ok
                    resolve(true);
                } else {
                    setNotificationType("error");
                    setNotification(notification);
                    resolve(false);
                }

                // Always update the pairs to make sure the pairHash for the next request is up to date
                setConfig(data.pairs);
            },
            null,
            (error) => {
                log.debug(error);
                setNotificationType("error");
                setNotification(error);
                resolve(false);
            },
        );
    });
};

export const refundAddressChange = (e, asset) => {
    const input = e.currentTarget;
    const inputValue = input.value.trim();
    try {
        getAddress(asset).toOutputScript(inputValue, getNetwork(asset));
        input.setCustomValidity("");
        setRefundAddress(inputValue);
        return true;
    } catch (e) {
        log.warn("parsing refund address failed", e);
        input.setCustomValidity("invalid address");
    }

    return false;
};

export const updateSwaps = (cb) => {
    const swapsTmp = swaps();
    const currentSwap = swapsTmp.find((s) => swap().id === s.id);
    cb(currentSwap);
    setSwaps(swapsTmp);
};

export default fetcher;
