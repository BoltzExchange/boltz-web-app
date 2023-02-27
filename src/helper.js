import QRCode from "qrcode";
import { setNotification, setNotificationType } from "./signals";

// export const BOLTZ_API_URL = "https://boltz.exchange/api";
export const BOLTZ_API_URL = "http://localhost:9001";

export const btc_divider = 100000000;

export const startInterval = (cb, interval) => {
  cb();
  return setInterval(cb, interval);
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
      if (!response.ok) {
          return Promise.reject(response);
      }
      return response.json();
    })
    .then(cb)
    .catch((error) => {
        setNotificationType("error")
        if (typeof error.json === "function") {
            error.json().then(jsonError => {
                setNotification(jsonError.error);
            }).catch(genericError => {
                setNotification(error.statusText);
            });
        } else {
            setNotification(error.message);
        }
    });
};

export const downloadRefundFile = (swap) => {
  let json = {
    id: swap.id,
    currency: "BTC",
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

export const qr = (data, cb) => {
  if (!data) return cb(null);
  QRCode.toDataURL(data, { version: 6, width: 400 })
    .then(cb)
    .catch((err) => {
        console.error("qr code generation error", err);
        setNotificationType("error")
        setNotification(err.message);
    });
};

export default fetcher;
