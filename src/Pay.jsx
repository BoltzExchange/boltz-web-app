import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { invoiceQr, setInvoiceQr, swap, setSwap, swapStatus, setSwapStatus, swaps, setNotification, setNotificationType } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, qr, downloadRefundFile } from "./helper";

import reload_svg from "./assets/reload.svg";

const Pay = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [t, { add, locale, dict }] = useI18n();

  const fetchSwapStatus = (id) => {
    fetcher("/swapstatus", (data) => {
      setSwapStatus(data.status);
      setNotificationType("success");
      setNotification("swap status retrieved!");
    }, {id: id});
    return false;
  };

  createEffect(() => {
      let tmp_swaps = JSON.parse(swaps());
      if (tmp_swaps) {
          let current_swap = tmp_swaps.filter(s => s.id === params.id).pop();
          fetchSwapStatus(params.id);
          setSwap(current_swap);
          console.log(current_swap);
          qr(current_swap.bip21, setInvoiceQr);
      }
  });

  const mempoolLink = (a) => {
    return "https://mempool.space/address/" + a;
  };

  return (
    <div class="frame">
      <h2>{t("pay_invoice", {id: params.id})}</h2>
      <p>{t("pay_invoice_subline")}</p>
      <p>Status: <span class="btn-small">{swapStatus()}</span> <span class="icon-reload" onClick={() => fetchSwapStatus(swap().id)}><img src={reload_svg} /></span></p>
      <hr />
      <Show when={swap()}>
          <p>
            {t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight} <br />
            {t("pay_expected_amount")}: {swap().expectedAmount} <br />
            {t("pay_address")}: {swap().address}
          </p>
          <hr />
          <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
          <hr />
          <span class="btn" onclick={() => navigator.clipboard.writeText(swap().address)}>{t("copy_onchain")}</span>
          <span class="btn" onclick={() => navigator.clipboard.writeText(swap().amount)}>{t("copy_amount")}</span>
          <span class="btn" onclick={() => navigator.clipboard.writeText(swap().bip21)}>{t("copy_bip21")}</span>
          <span class="btn btn-success" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
          <span class="btn btn-success" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
          <a class="btn btn-mempool" target="_blank" href={mempoolLink(swap().address)}>{t("mempool")}</a>
          <span class="btn btn-success" onclick={() => navigate("/swap/"+params.id+"/success")}>Success TEST</span>
      </Show>
      <Show when={!swap()}>
          <p>{t("pay_swap_404")}</p>
      </Show>
    </div>
  );
};

export default Pay;
