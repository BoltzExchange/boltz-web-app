import log from 'loglevel';
import { createEffect, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { setSwapStatusTransaction, reverse, setReverse, denomination, setInvoiceQr, swap, setSwap, swapStatus, setSwapStatus, swaps, setSwaps } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { fetchSwapStatus, claim, fetcher, qr, } from "./helper";
import { mempool_url, api_url } from "./config";

import reload_svg from "./assets/reload.svg";
import InvoiceSet from "./status/InvoiceSet";
import InvoiceFailedToPay from "./status/InvoiceFailedToPay";
import TransactionRefunded from "./status/TransactionRefunded";
import TransactionMempool from "./status/TransactionMempool";
import TransactionConfirmed from "./status/TransactionConfirmed";
import TransactionLockupFailed from "./status/TransactionLockupFailed";
import TransactionClaimed from "./status/TransactionClaimed";
import SwapExpired from "./SwapExpired";


const Pay = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [t, { add, locale, dict }] = useI18n();

  let stream = null;

  createEffect(() => {
      let tmp_swaps = JSON.parse(swaps());
      if (tmp_swaps) {
          let current_swap = tmp_swaps.filter(s => s.id === params.id).pop();
          if (current_swap) {
              log.debug("selecting swap", current_swap);
              setSwap(current_swap);
              fetchSwapStatus(current_swap);
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
                      claim(current_swap);
                  }
              };
          }
      }
  });


  const mempoolLink = (a) => {
    return mempool_url + "/address/" + a;
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
          </p>
          <hr />
          <Show when={swapStatus() == "swap.expired" || swapStatus() == "invoice.expired"}><SwapExpired /></Show>
          <Show when={swapStatus() == "transaction.claimed" || swapStatus() == "invoice.settled"}><TransactionClaimed /></Show>
          <Show when={swapStatus() == "transaction.confirmed"}><TransactionConfirmed /></Show>
          <Show when={swapStatus() == "transaction.mempool"}><TransactionMempool /></Show>
          <Show when={swapStatus() == "invoice.failedToPay"}><InvoiceFailedToPay /></Show>
          <Show when={swapStatus() == "transaction.lockupFailed"}><TransactionLockupFailed /></Show>
          <Show when={swapStatus() == "transaction.refunded"}><TransactionRefunded /></Show>
          <Show when={swapStatus() == "invoice.set"}><InvoiceSet /></Show>
          <a class="btn btn-mempool" target="_blank" href={mempoolLink(!reverse() ? swap().address : swap().lockupAddress )}>{t("mempool")}</a>
      </Show>
      <Show when={!swap()}>
          <p>{t("pay_swap_404")}</p>
      </Show>
    </div>
  );
};

export default Pay;
