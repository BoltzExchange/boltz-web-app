import log from 'loglevel';
import { createEffect, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import {
    refundAddress, setRefundAddress,
    setSwapStatusTransaction, swapStatusTransaction,
    failureReason, setFailureReason, reverse, setReverse, webln,
    denomination, invoiceQr, setInvoiceQr, swap, setSwap, swapStatus, setSwapStatus, swaps, setSwaps, setNotification, setNotificationType } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, qr, downloadRefundFile, clipboard } from "./helper";
import { mempool_url, api_url, net } from "./config";

import { Buffer } from "buffer";
import { ECPair } from "./ecpair/ecpair";
import { Transaction, networks, address } from "bitcoinjs-lib";
import { constructClaimTransaction, constructRefundTransaction, detectSwap } from "boltz-core";

import reload_svg from "./assets/reload.svg";

const Pay = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [t, { add, locale, dict }] = useI18n();

  const fetchSwapStatus = (id) => {
    fetcher("/swapstatus", (data) => {
      setSwapStatus(data.status);
      setSwapStatusTransaction(data.transaction);
      if (data.status == "transaction.confirmed" && data.transaction) {
          claim();
      }
      setFailureReason(data.failureReason);
      setNotificationType("success");
      setNotification("swap status retrieved!");
    }, {id: id});
    return false;
  };

  let stream = null;

  createEffect(() => {
      let tmp_swaps = JSON.parse(swaps());
      if (tmp_swaps) {
          let current_swap = tmp_swaps.filter(s => s.id === params.id).pop();
          if (current_swap) {
              log.debug("selecting swap", current_swap);
              fetchSwapStatus(params.id);
              setSwap(current_swap);
              setReverse(current_swap.reverse)
              qr((current_swap.reverse) ? current_swap.invoice : current_swap.bip21, setInvoiceQr);
              if (stream) {
                  log.debug("stream closed");
                  stream.close();
              }
              let stream_url = `${api_url}/streamswapstatus?id=${params.id}`;
              stream = new EventSource(stream_url);
              log.debug(`stream started: ${stream_url}`);
              stream.onmessage = function(event) {
                  const data = JSON.parse(event.data);
                  log.debug(`Event status update: ${data.status}`, data);
                  setSwapStatus(data.status);
                  setSwapStatusTransaction(data.transaction);
                  if (data.status == "transaction.confirmed" && data.transaction) {
                      claim();
                  }
              };
          }
      }
  });

  const refund = () => {
    let output = "";
    try {
      output = address.toOutputScript(refundAddress(), net);
    }
    catch (e){
        log.error(e);
        setNotificationType("error");
        setNotification("invalid onchain address");
        return false;
    }
    log.info("refunding swap: ", swap().id);

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
        let tx = Transaction.fromHex(data.transactionHex);
        let script = Buffer.from(swap().redeemScript, "hex");
        log.debug("script", script);
        let swapOutput = detectSwap(script, tx);
        log.debug("swapoutput", swapOutput);
        let private_key = ECPair.fromPrivateKey(Buffer.from(swap().privateKey, "hex"));
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
          10, // fee vbyte
          true, // rbf
        ).toHex();

        log.debug("refund_tx", refundTransaction);

        fetcher("/broadcasttransaction", (data) => {
            log.debug("refund result:", data);
        }, {
            "currency": "BTC",
            "transactionHex": refundTransaction,
        });
    }, {
        "id": swap().id,
    });
  };

  const claim = () => {

    log.info("claiming swap: ", swap().id);
    let mempool_tx = swapStatusTransaction();
    if (!mempool_tx) {
      return log.debug("no mempool tx found");
    }
    if (!mempool_tx.hex) {
      return log.debug("mempool tx hex not found");
    }
    log.debug("mempool_tx", mempool_tx.hex);
    let tx = Transaction.fromHex(mempool_tx.hex);
    let script = Buffer.from(swap().redeemScript, "hex");
    let swapOutput = detectSwap(script, tx);
    let private_key = ECPair.fromPrivateKey(Buffer.from(swap().privateKey, "hex"));
    log.debug("private_key: ", private_key);
    let preimage = Buffer.from(swap().preimage, "hex");
    log.debug("preimage: ", preimage);
    const claimTransaction = constructClaimTransaction(
      [{
        ...swapOutput,
        txHash: tx.getHash(),
        preimage: preimage,
        redeemScript: script,
        keys: private_key,
      }],
      address.toOutputScript(swap().onchainAddress, net),
      10,
      true,
    ).toHex();
    log.debug("claim_tx", claimTransaction);

    fetcher("/broadcasttransaction", (data) => {
        log.debug("claim result:", data);
    }, {
        "currency": "BTC",
        "transactionHex": claimTransaction,
    });

  };


  const mempoolLink = (a) => {
    return mempool_url + "/address/" + a;
  };

  const can_reload = (status) => {
    return status != "transaction.claimed"
          && status != "invoice.settled"
          && status != "transaction.lockupFailed"
          && status != "swap.expired";
  };

  const payWeblnInvoice = async (pr) => {
      let check_enable = await window.webln.enable();
      if (check_enable.enabled) {
          const result = await window.webln.sendPayment(pr);
          log.debug("webln payment result:", result);
          fetchSwapStatus(swap().id);
      }
  };

  onCleanup(() => {
      log.debug("cleanup Pay");
      if (stream) {
          log.debug("stream closed");
          stream.close();
      }
  });

  return (
    <div data-status={swapStatus()} class="frame">
      <h2>
        {t("pay_invoice", {id: params.id})}
      <Show when={swap()}><span data-reverse={swap().reverse} data-asset={swap().asset} class="past-asset">-</span></Show>
      </h2>
      <p>{t("pay_invoice_subline")}</p>
      <Show when={swap()}>
          <p>
              Status: <span class="btn-small">{swapStatus()}</span>
              <Show when={can_reload(swapStatus())}>
                  <span class="icon-reload" onClick={() => fetchSwapStatus(swap().id)}><img src={reload_svg} /></span>
              </Show>
          </p>
      </Show>
      <hr />
      <Show when={swap()}>
          <Show when={swapStatus() == "swap.expired" || swapStatus() == "invoice.expired"}>
              <h2>{t("expired")}</h2>
              <p>{t("swap_expired")}</p>
              <hr />
              <input
                onKeyUp={(e) => setRefundAddress(e.currentTarget.value)}
                onChange={(e) => setRefundAddress(e.currentTarget.value)}
                type="text"
                id="refundAddress"
                name="refundAddress"
                placeholder={t("refund_address_placeholder")}
              />
              <span class="btn" onclick={() => refund()}>{t("refund")}</span>
              <hr />
              <span class="btn" onClick={(e) => navigate("/swap")}>{t("new_swap")}</span>
          </Show>
          <Show when={swapStatus() == "transaction.claimed" || swapStatus() == "invoice.settled"}>
              <h2>{t("congrats")}</h2>
              <p>{t("successfully_swapped", {amount: swap().expectedAmount, denomination: denomination()})}</p>
              <hr />
              <span class="btn" onClick={(e) => navigate("/swap")}>{t("new_swap")}</span>
          </Show>
          <Show when={swapStatus() == "transaction.confirmed"}>
              <h2>{t("tx_confirmed")}</h2>
              <p>{t("tx_ready_to_claim")}</p>
              <div class="spinner">
                <div class="bounce1"></div>
                <div class="bounce2"></div>
                <div class="bounce3"></div>
              </div>
          </Show>
          <Show when={swapStatus() == "transaction.mempool"}>
              <h2>{t("tx_in_mempool")}</h2>
              <p>{t("tx_in_mempool_subline")}</p>
              <div class="spinner">
                <div class="bounce1"></div>
                <div class="bounce2"></div>
                <div class="bounce3"></div>
              </div>
          </Show>
          <Show when={swapStatus() == "invoice.failedToPay"}>
              <h2>{t("lockup_failed")}</h2>
              <p>{t("lockup_failed_reason")}: {failureReason()}</p>
              SHOW ETA
              <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
              <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
              <hr />
          </Show>
          <Show when={swapStatus() == "transaction.lockupFailed"}>
              <h2>{t("lockup_failed")}</h2>
              <p>{t("lockup_failed_reason")}: {failureReason()}</p>
              SHOW ETA
              <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
              <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
              <hr />
          </Show>
          <Show when={swapStatus() != "swap.expired" && swapStatus() != "invoice.expired" && swapStatus() != "transaction.confirmed" && swapStatus() != "transaction.claimed" && swapStatus() != "transaction.mempool" && swapStatus() != "transaction.lockupFailed" && swapStatus() != "invoice.settled"}>
              <p>
                {t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight} <br />
                <Show when={!reverse()}>
                    {t("pay_expected_amount")}: {swap().expectedAmount} <br />
                </Show>
              </p>
              <hr />
              <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
              <hr />
              <Show when={!reverse()}>
                  <span class="btn" onclick={() => clipboard(swap().bip21, t("copied"))}>{t("copy_bip21")}</span>
                  <span class="btn" onclick={() => clipboard(swap().address, t("copied"))}>{t("copy_onchain")}</span>
                  <span class="btn" onclick={() => clipboard(swap().expectedAmount, t("copied"))}>{t("copy_amount")}</span>
                  <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
                  <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
              </Show>
              <Show when={reverse()}>
                  <Show when={webln()}>
                      <span class="btn btn-light" onClick={(e) => payWeblnInvoice(swap().invoice)}>{t("pay_invoice_webln")}</span>
                  </Show>
                  <span class="btn" onclick={() => navigator.clipboard.writeText(swap().invoice)}>{t("copy_invoice")}</span>
              </Show>
          </Show>
          <a class="btn btn-mempool" target="_blank" href={mempoolLink(!reverse() ? swap().address : swap().lockupAddress )}>{t("mempool")}</a>
      </Show>
      <Show when={!swap()}>
          <p>{t("pay_swap_404")}</p>
      </Show>
    </div>
  );
};

export default Pay;
