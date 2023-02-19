import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";
import { upload, setUpload } from "./signals";

const [error, setError] = createSignal("no file seleced");
const [refundJson, setRefundJson] = createSignal(null);
const [refundAddress, setRefundAddress] = createSignal(null);

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
  return (
    <div id="steps">
        <div class="frame">
          <h2>Refund a failed swap</h2>
          <p>Upload your refund.json file and reclaim you on-chain funds</p>
          <hr />
          <input
            onKeyUp={refundAddressChange}
            onChange={refundAddressChange}
            type="text"
            id="refundAddress"
            name="refundAddress"
            placeholder="Refund On-chain address"
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
    </div>
  );
};

export default Refund;
