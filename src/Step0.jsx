import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, btc_divider, startInterval, focus } from "./helper";
import Tags from "./Tags";
import btc_svg from "./assets/btc.svg";
import sat_svg from "./assets/sat.svg";
import bitcoin_svg from "./assets/bitcoin-icon.svg";
import liquid_svg from "./assets/liquid-icon.svg";

import {
  asset,
  setAsset,
  denomination,
  setDenomination,
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

  // createEffect(() => {
  //   let denom = denomination();
  //   let amount = sendAmount();
  //   amout = (denom == "btc") ? amount * btc_divider :  (amount / btc_divider).toFixed(8);
  //   setSendAmount(amount)
  // });

  createEffect(() => {
    let cfg = config();
    let denom = denomination();
    if (cfg) {
      let divider = (denom == "btc") ? btc_divider : 1;
      setMinimum(cfg.limits.minimal / divider);
      setMaximum(cfg.limits.maximal / divider);
      setBoltzFee(cfg.fees.percentage);
      if (reverse()) {
        let rev = cfg.fees.minerFees.baseAsset.reverse;
        let fee = rev.claim + rev.lockup;
        if (denom == "btc") {
            fee = (fee / btc_divider).toFixed(8);
        }
        setMinerFee(fee);
      } else {
        let fee = cfg.fees.minerFees.baseAsset.normal;
        if (denom == "btc") {
            fee = (fee / btc_divider).toFixed(8);
        }
        setMinerFee(fee);
      }
    }
  });

  createEffect(() => {
    let send_amount = 100000;
    if (denomination() == "btc") {
        send_amount = 0.001;
    }
    setSendAmount(send_amount)
  });

  createEffect(() => {
    let send_amount = sendAmount();
    let amount = send_amount - minerFee() - (send_amount * boltzFee()) / 100;
    if (denomination() == "btc") {
        amount = amount.toFixed(8);
    }
    setReceiveAmount(amount);
  });

  const [t, { add, locale, dict }] = useI18n();

  return (
    <div data-reverse={reverse()}>
      <h2>{t("create_swap")}</h2>
      <p>{t("create_swap_subline")}</p>
      <hr />
      <div className="denomination-assets">
          <div class="denomination">
              <label>{t("denomination")}: </label>
              <img src={btc_svg} onClick={() => setDenomination("btc")} class={denomination() == "btc" ? "active" : ""} alt="denominator" />
              <img src={sat_svg} onClick={() => setDenomination("sat")} class={denomination() == "sat" ? "active" : ""} alt="denominator" />
          </div>
          <div class="assets">
              <label>{t("assets")}: </label>
              <img src={bitcoin_svg} onClick={() => setAsset("btc")} alt="bitcoin" />
              <img src={liquid_svg} onClick={() => setAsset("l-btc")} alt="liquid bitcoin" />
          </div>
      </div>
      <hr />
      <div class="icons" data-asset={asset()}>
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
              step={denomination() == "btc" ? 0.00000001 : 1 }
              maxlength="10"
              min={minimum()}
              max={maximum()}
              type="number"
              id="sendAmount"
              value={sendAmount()}
              onChange={checkAmount}
              onKeyUp={checkAmount}
            />
      </div>
          <div>
            <span id="receiveAmount">{receiveAmount()}</span>
            <span class="denominator" data-denominator={denomination()}></span>
            <label>{t("network_fee")}</label> <span class="network-fee">{minerFee()} <span class="denominator" data-denominator={denomination()}></span></span>
          </div>
        </div>
      </form>
      <hr />
      <Tags />
      <hr />
      <div class="fees">
        <div class="fee">
          <span>
            <b>{minimum()}</b>
            <span class="denominator" data-denominator={denomination()}></span>
          </span>
          <br />
          <label>{t("min")}</label>
        </div>
        <div class="fee">
          <span>
            <b>{maximum()}</b>
            <span class="denominator" data-denominator={denomination()}></span>
          </span>
          <br />
          <label>{t("max")}</label>
        </div>
        <div class="fee">
          <span>
            <b>{boltzFee()} %</b>
          </span>
          <br />
          <label>{t("fee")}</label>
        </div>
      </div>
      <hr />
      <label id="invoiceLabel">{t("create_and_paste", { amount: sendAmount(), denomination: denomination()})}</label>
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
    </div>
  );
};

export default Step0;
