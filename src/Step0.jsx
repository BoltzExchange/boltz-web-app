import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, divider, startInterval, focus } from "./helper";
import Tags from "./Tags";

import {
  boltzFee,
  setBoltzFee,
  sendAmount,
  setSendAmount,
  minerFee,
  setMinerFee,
  minimum,
  setMinimum,
  maximum,
  setMaximum,
  receiveAmount,
  setReceiveAmount,
  reverse,
  setReverse,
  config,
  setConfig,
  valid,
  setValid,
  setInvoice,
  setOnchainAddress,
} from "./signals";

export const checkAmount = (e) => {
  let errorkey = "";
  let target = document.getElementById("sendAmount");
  target.checkValidity();
  setValid(false);
  for (let k in target.validity) {
    if (k === "valid") continue;
    if (target.validity[k]) {
      errorkey = k;
      setValid(false);
      break;
    }
    setValid(true);
  }

  if (valid()) {
    setSendAmount(target.value);
  } else {
    setReceiveAmount(errorkey);
  }
};

const Step0 = () => {
  startInterval(() => {
    fetcher("/getpairs", (data) => {
      let cfg = data.pairs["BTC/BTC"];
      setConfig(cfg);
    });
  });

  createEffect(() => {
    let cfg = config();
    if (cfg) {
      setMinimum(cfg.limits.minimal / divider);
      setMaximum(cfg.limits.maximal / divider);
      setBoltzFee(cfg.fees.percentage);
      if (reverse()) {
        let rev = cfg.fees.minerFees.baseAsset.reverse;
        let fee = (rev.claim + rev.lockup) / divider;
        setMinerFee(fee.toFixed(8));
      } else {
        let fee = cfg.fees.minerFees.baseAsset.normal / divider;
        setMinerFee(fee.toFixed(8));
      }
    }
  });

  createEffect(() => {
    let amount = sendAmount() - minerFee() - (sendAmount() * boltzFee()) / 100;
    setReceiveAmount(amount.toFixed(8));
  });

  const [t, { add, locale, dict }] = useI18n();

  return (
    <div data-reverse={reverse()}>
      <h2>{t("create_swap")}</h2>
      <p>{t("create_swap_subline")}</p>
      <hr />
      <div class="icons">
        <div>
          <span
            class="icon-1 icon"
            onClick={(e) => {
              setReverse(!reverse());
              focus();
            }}
          ></span>
        </div>
        <div>
          <div id="reverse">
            <input
              type="checkbox"
              value="true"
              checked={reverse()}
              onChange={(e) => {
                setReverse(e.currentTarget.checked);
                focus();
              }}
            />
          </div>
        </div>
        <div>
          <span
            class="icon-2 icon"
            onClick={(e) => setReverse(!reverse())}
          ></span>
        </div>
      </div>
      <form name="swap" action="#">
        <div>
          <div>
            <input
              autofocus
              required
              step="0.00000001"
              maxlength="10"
              min={minimum()}
              max={maximum()}
              type="number"
              id="sendAmount"
              value={sendAmount()}
              onChange={checkAmount}
              onKeyUp={checkAmount}
            />
            <label>BTC</label>
          </div>
          <div>
            <span
              id="receiveAmount"
              onClick={(e) => {
                setReverse(!reverse());
                focus();
              }}
            >
              {receiveAmount()}
            </span>
            <label>BTC</label>
          </div>
        </div>
      </form>
      <Tags />
      <hr />
      <div class="fees">
        <div class="fee">
          <span>
            <b>{minimum()} BTC</b>
          </span>
          <br />
          <label>Min. amount</label>
        </div>
        <div class="fee">
          <span>
            <b>{maximum()} BTC</b>
          </span>
          <br />
          <label>Max. amount</label>
        </div>
        <div class="fee">
          <span>
            <b>{boltzFee()} %</b>
          </span>
          <br />
          <label>Boltz fee</label>
        </div>
        <div class="fee">
          <span>
            <b>{minerFee()} BTC</b>
          </span>
          <br />
          <label>Miner fee</label>
        </div>
      </div>
      <hr />
      <label id="invoiceLabel">
        Create an invoice with exactly{" "}
        <b>{Math.floor(sendAmount() * 100000000)}</b> sats and paste it here
      </label>
      <textarea
        onChange={(e) => setInvoice(e.currentTarget.value)}
        id="invoice"
        name="invoice"
        placeholder="Paste lightning invoice"
      ></textarea>
      <input
        onChange={(e) => setOnchainAddress(e.currentTarget.value)}
        type="text"
        id="onchainAddress"
        name="onchainAddress"
        placeholder="On-chain address"
      />
      <hr />
      <p>creates a swap and go to the invoicing step.</p>
    </div>
  );
};

export default Step0;
