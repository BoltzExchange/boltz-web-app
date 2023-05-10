import { createSignal, createEffect } from "solid-js";
import { refundTx, refundAddress, setRefundAddress, upload, setUpload } from "./signals";
import { mempoolLink, refund } from "./helper";

const [error, setError] = createSignal("no file seleced");
const [refundJson, setRefundJson] = createSignal(null);
import { useI18n } from "@solid-primitives/i18n";

createEffect(() => {
  new Response(upload()).json().then(
    (json) => {
      if (json === 0) return;
      setRefundJson(json);
    },
    (err) => {
      setRefundJson(null);
      setError("not a json file");
    }
  );
});

createEffect(() => {
  if (refundAddress() === null) return setError("no refund address");
  if (refundJson() === null) return setError("no json file");
  setError(false);
});

const refundAddressChange = (e) => {
  let t = e.currentTarget;
  if (t.value.trim()) {
    setRefundAddress(t.value.trim());
  } else {
    setRefundAddress(null);
  }
};

const Refund = () => {

  const [t, { add, locale, dict }] = useI18n();

  return (
    <div id="refund">
        <div class="frame">
          <h2>{t("refund_a_swap")}</h2>
          <p>{t("refund_a_swap_subline")}</p>
          <hr />
          <input
            onKeyUp={refundAddressChange}
            onChange={refundAddressChange}
            type="text"
            id="refundAddress"
            name="refundAddress"
            placeholder={t("refund_address_placeholder")}
          />
          <input
            type="file"
            id="refundUpload"
            onChange={(e) => setUpload(e.currentTarget.files[0])}
          />
          <div class={error() === false ? "hidden" : ""}>
            <span class="error">{error()}</span>
          </div>
          <div class={error() !== false ? "hidden" : ""}>
            <span class="btn btn-success" onClick={() => refund(refundJson())}>{t("refund")}</span>
          </div>
          <Show when={refundTx() !== ""}>
            <hr />
            <a class="btn btn-mempool" target="_blank" href={mempoolLink(refundJson().asset, refundTx() )}>{t("mempool")}</a>
          </Show>
        </div>
    </div>
  );
};

export default Refund;
