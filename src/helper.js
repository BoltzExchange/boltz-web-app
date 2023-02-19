import QRCode from "qrcode";

// export const BOLTZ_API_URL = "https://boltz.exchange/api";
export const BOLTZ_API_URL = "http://localhost:9001";

export const divider = 100000000;

export const startInterval = (cb) => {
  cb();
  return setInterval(cb, 10000);
};

export const focus = () => {
  document.getElementById("sendAmount").focus();
};

export const fetcher = (url, cb, params = null) => {
  let opts = {};
  if (params) {
    params.referralId = "dni";
    opts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    };
  }
  fetch(BOLTZ_API_URL + url, opts)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Request failed with status ${response.status}`);
      return response.json();
    })
    .then(cb)
    .catch((error) => console.error(error));
};

export const downloadRefundFile = (swap) => {
  let json = {
    id: swap.boltz_id,
    currency: "BTC",
    redeemScript: swap.redeem_script,
    privateKey: swap.refund_privkey,
    timeoutBlockHeight: swap.timeout_block_height,
  };
  let hiddenElement = document.createElement("a");
  hiddenElement.href =
    "data:application/json;charset=utf-8," + encodeURI(JSON.stringify(json));
  hiddenElement.target = "_blank";
  hiddenElement.download = "boltz-refund-" + swap.boltz_id + ".json";
  hiddenElement.click();
};

export const qr = (data, cb) => {
  if (!data) return cb(null);
  QRCode.toDataURL(data, { version: 6, width: 400 })
    .then(cb)
    .catch((err) => {
      console.error(err);
    });
};

export default fetcher;
