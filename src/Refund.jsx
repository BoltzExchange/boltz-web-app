import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";
import { upload, setUpload, swaps } from "./signals";

const [error, setError] = createSignal("no file seleced");
const [refundJson, setRefundJson] = createSignal(null);
const [refundAddress, setRefundAddress] = createSignal(null);
import { useParams, useNavigate } from "@solidjs/router";
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

const refund = (e) => {
  console.log("not implemented yet", refundAddress(), refundJson());
};

const refundAddressChange = (e) => {
  let t = e.currentTarget;
  if (t.value.trim()) {
    setRefundAddress(t.value.trim());
  } else {
    setRefundAddress(null);
  }
};

const Refund = () => {

  const navigate = useNavigate();
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
            <span class="btn btn-success" onClick={refund}>
              refund
            </span>
          </div>
        </div>
        <Show when={JSON.parse(swaps()).length > 0}>
            <div class="frame">
              <h2>{t("refund_past_swaps")}</h2>
              <p>{t("refund_past_swaps_subline")}</p>
              <hr />
              <div id="past-swaps">
                  <For each={JSON.parse(swaps())} fallback={<div>Loading...</div>}>
                      {(_swap) => (
                          <div class="past-swap">
                              <button onClick={() => navigate("/swap/" + _swap.id)}>status</button> |
                              ID: {_swap.id}, Timeout: {_swap.timeoutBlockHeight}, Amount: {_swap.expectedAmount}
                              <hr />
                          </div>
                      )}
                  </For>
              </div>
              <button class="btn btn-danger" onClick={() => setSwaps("[]")}>{t("refund_clear")}</button>
            </div>
        </Show>
    </div>
  );
};

export default Refund;
