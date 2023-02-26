import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { invoiceQr, setInvoiceQr, swap, setSwap, swaps } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";
import { qr, downloadRefundFile } from "./helper";

const Pay = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [t, { add, locale, dict }] = useI18n();

  createEffect(() => {
      let tmp_swaps = JSON.parse(swaps());
      if (tmp_swaps) {
          let current_swap = tmp_swaps.filter(s => s.id === params.id).pop();
          setSwap(current_swap);
          console.log(current_swap);
          qr(current_swap.bip21, setInvoiceQr);
      }
  });

  return (
    <div class="frame">
      <h2>{t("pay_invoice", {id: params.id})}</h2>
      <p>{t("pay_invoice_subline")}</p>
      <hr />
      <Show when={swap()}>
          <p>{t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight}</p>
          <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
          <span class="btn btn-danger" onclick={() => downloadRefundFile(swap())}>{t("download_refund_json")}</span>
          <span class="btn btn-danger" onclick={() => downloadRefundQr(swap())}>{t("download_refund_qr")}</span>
          <span class="btn btn-success" onclick={() => navigate("/swap/"+params.id+"/success")}>Success</span>
      </Show>
      <Show when={!swap()}>
          <p>{t("pay_swap_404")}</p>
      </Show>
    </div>
  );
};

export default Pay;
