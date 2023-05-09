import log from 'loglevel';
import QRCode from "qrcode";

import { bech32, utf8 } from '@scure/base';
import { setTimeoutEta, setTimeoutBlockheight, setFailureReason, setSwapStatus, setSwapStatusTransaction, swapStatusTransaction, setNotification, setNotificationType, refundAddress } from "./signals";

import { Buffer } from "buffer";
import { ECPair } from "./ecpair/ecpair";
import { getNetwork, getAddress, getTransaction, getConstructClaimTransaction, getConstructRefundTransaction, getDetectSwap} from "./compat";

import { api_url } from "./config";

export const btc_divider = 100000000;

export const startInterval = (cb, interval) => {
  cb();
  return setInterval(cb, interval);
};


export const clipboard = (text, message) => {
  navigator.clipboard.writeText(text);
  setNotificationType("success")
  setNotification(message);
};


export const errorHandler = (error) => {
    setNotificationType("error")
    if (typeof error.json === "function") {
        error.json().then(jsonError => {
            setNotification(jsonError.error);
        }).catch(genericError => {
            log.error(genericError);
            setNotification(error.statusText);
        });
    } else {
        setNotification(error.message);
    }
};

export const checkResponse = (response) => {
  if (!response.ok) {
      return Promise.reject(response);
  }
  return response.json();
};

export const fetcher = (url, cb, params = null) => {
  let opts = {};
  if (params) {
    params.referralId = "frontend";
    opts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    };
  }
  fetch(api_url + url, opts)
    .then(checkResponse)
    .then(cb)
    .catch(errorHandler);
};

export const fetchSwapStatus = (swap) => {
  fetcher("/swapstatus", (data) => {
    setSwapStatus(data.status);
    setSwapStatusTransaction(data.transaction);
    if (data.status == "transaction.confirmed" && data.transaction) {
        claim(swap);
    }
    if (data.status == "transaction.lockupFailed" || data.status == "invoice.failedToPay") {
        fetcher("/getswaptransaction", (data) => {
            if (!data.transactionHex) {
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
        }, {
            "id": swap.id,
        });
    };
    setFailureReason(data.failureReason);
    setNotificationType("success");
    setNotification("swap status retrieved!");
  }, {id: swap.id});
  return false;
};

export const downloadRefundFile = (swap) => {
  let json = {
    id: swap.id,
    currency: swap.asset,
    asset: swap.asset,
    redeemScript: swap.redeemScript,
    privateKey: swap.privateKey,
    timeoutBlockHeight: swap.timeoutBlockHeight,
  };
  let hiddenElement = document.createElement("a");
  hiddenElement.href =
    "data:application/json;charset=utf-8," + encodeURI(JSON.stringify(json));
  hiddenElement.target = "_blank";
  hiddenElement.download = "boltz-refund-" + swap.id + ".json";
  hiddenElement.click();
};

export const downloadRefundQr = (swap) => {
  let json = {
    id: swap.id,
    currency: swap.asset,
    redeemScript: swap.redeemScript,
    privateKey: swap.privateKey,
    timeoutBlockHeight: swap.timeoutBlockHeight,
  };
  let hiddenElement = document.createElement("a");
  hiddenElement.href =
    "data:application/json;charset=utf-8," + encodeURI(JSON.stringify(json));
  hiddenElement.target = "_blank";
  hiddenElement.download = "boltz-refund-" + swap.id + ".json";
  hiddenElement.click();
};

export const downloadBackup = (json) => {
  let hiddenElement = document.createElement("a");
  hiddenElement.href =
    "data:application/json;charset=utf-8," + encodeURI(json);
  hiddenElement.target = "_blank";
  hiddenElement.download = "boltz-backup-localstorage.json";
  hiddenElement.click();
};

export const qr = (data, cb) => {
  if (!data) return cb(null);
  QRCode.toDataURL(data, { version: 13, width: 400 })
    .then(cb)
    .catch((err) => {
        log.error("qr code generation error", err);
        setNotificationType("error")
        setNotification(err.message);
    });
};

export async function detectWebLNProvider(timeoutParam) {
  const timeout = timeoutParam ?? 3000;
  const interval = 100;
  let handled = false;

  return new Promise((resolve) => {
    if (window.webln) {
      handleWebLN();
    } else {
      document.addEventListener("webln:ready", handleWebLN, { once: true });

      let i = 0;
      const checkInterval = setInterval(function() {
        if (window.webln || i >= timeout/interval) {
          handleWebLN();
          clearInterval(checkInterval);
        }
        i++;
      }, interval);
    }

    function handleWebLN() {
      if (handled) {
        return;
      }
      handled = true;

      document.removeEventListener("webln:ready", handleWebLN);

      if (window.webln) {
        resolve(window.webln);
      } else {
        resolve(null);
      }
    }
  });
};


export function lnurl_fetcher(lnurl, amount_sat) {
    return new Promise((resolve) => {
        let url = "";
        let amount = amount_sat * 1000;
        if (lnurl.indexOf("@") > 0) {
            // Lightning address
            let urlsplit = lnurl.split("@")
            url = `https://${urlsplit[1]}/.well-known/lnurlp/${urlsplit[0]}`
        } else {
            // LNURL
            const { prefix, words, bytes } = bech32.decodeToBytes(lnurl);
            url = utf8.encode(bytes);
        }
        log.debug("fetching lnurl:", url);
        fetch(url)
            .then(checkResponse)
            .then((data) => {
                log.debug("amount check: (x, min, max)", amount, data.minSendable, data.maxSendable);
                if (amount < data.minSendable || amount > data.maxSendable) {
                  return Promise.reject("Amount not in LNURL range.");
                }
                log.debug("fetching invoice", `${data.callback}?amount=${amount}`);
                fetch(`${data.callback}?amount=${amount}`)
                    .then(checkResponse)
                    .then((data) => {
                        log.debug("fetched invoice", data);
                        resolve(data.pr);
                    })
                    .catch(errorHandler);
            })
            .catch(errorHandler);
    });
};

export async function refund(swap) {
    let output = "";

    log.debug("starting to refund swap", swap);

    const asset_name = swap.asset;
    const address = getAddress(asset_name);
    const net = getNetwork(asset_name);

    try {
        output = address.toOutputScript(refundAddress(), net);
    }
    catch (e){
        log.error(e);
        setNotificationType("error");
        setNotification("invalid onchain address");
        return false;
    }
    log.info("refunding swap: ", swap.id);
    let fees = await getfeeestimation(swap);

    fetcher("/getswaptransaction", (data) => {
        log.debug("refund swap result:", data);
        if (!data.transactionHex) {
            return log.debug("no mempool tx found");
        }
        if (data.timeoutEta) {
            const eta = new Date(data.timeoutEta * 1000);
            const msg = "Timeout Eta: \n " + eta.toLocaleString();
            setNotificationType("error");
            setNotification(msg);
            log.error(msg);
            return false;
        }
        const Transaction = getTransaction(asset_name);
        const constructRefundTransaction = getConstructRefundTransaction(asset_name);
        const detectSwap = getDetectSwap(asset_name);
        const net = getNetwork(asset_name);
        const assetHash = asset_name === "L-BTC" ? net.assetHash : undefined;

        let tx = Transaction.fromHex(data.transactionHex);
        let script = Buffer.from(swap.redeemScript, "hex");
        log.debug("script", script);
        let swapOutput = detectSwap(script, tx);
        log.debug("swapoutput", swapOutput);
        let private_key = ECPair.fromPrivateKey(Buffer.from(swap.privateKey, "hex"));
        log.debug("privkey", private_key);
        const refundTransaction = constructRefundTransaction(
            [{
                ...swapOutput,
                txHash: tx.getHash(),
                redeemScript: script,
                keys: private_key,
            }],
            output,
            data.timeoutBlockHeight,
            fees,
            true, // rbf
            assetHash
        ).toHex();

        log.debug("refund_tx", refundTransaction);
        fetcher("/broadcasttransaction", (data) => {
            log.debug("refund result:", data);
            if (data.transactionId) {
                setNotificationType("success");
                setNotification(`Refund transaction broadcasted: ${data.transactionId}`);
            }
        }, {
            "currency": asset_name,
            "transactionHex": refundTransaction,
        });
    }, {
        "id": swap.id,
    });
};

export async function getfeeestimation(swap) {
    return new Promise((resolve) => {
        fetcher("/getfeeestimation", (data) => {
            log.debug("getfeeestimation: ", data);
            let asset = swap.asset;
            resolve(data[asset]);
        });
    });
};

export const claim = async (swap) => {
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
    const constructClaimTransaction = getConstructClaimTransaction(asset_name);
    const detectSwap = getDetectSwap(asset_name);
    const address = getAddress(asset_name);
    const net = getNetwork(asset_name);
    const assetHash = asset_name === "L-BTC" ? net.assetHash : undefined;

    let fees = await getfeeestimation(swap);
    let tx = Transaction.fromHex(mempool_tx.hex);
    let script = Buffer.from(swap.redeemScript, "hex");

    let swapOutput = detectSwap(script, tx);
    let private_key = ECPair.fromPrivateKey(Buffer.from(swap.privateKey, "hex"));
    log.debug("private_key: ", private_key);
    let preimage = Buffer.from(swap.preimage, "hex");
    log.debug("preimage: ", preimage);
    const claimTransaction = constructClaimTransaction(
        [{
            ...swapOutput,
            txHash: tx.getHash(),
            preimage: preimage,
            redeemScript: script,
            keys: private_key,
        }],
        address.toOutputScript(swap.onchainAddress, net),
        fees,
        true,
        assetHash,
    ).toHex();
    log.debug("claim_tx", claimTransaction);

    fetcher("/broadcasttransaction", (data) => {
        log.debug("claim result:", data);
    }, {
        "currency": asset_name,
        "transactionHex": claimTransaction,
    });

};


export default fetcher;
