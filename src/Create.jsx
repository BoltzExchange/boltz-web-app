import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, btc_divider, startInterval, focus } from "./helper";
import { useNavigate } from "@solidjs/router";

import * as secp from '@noble/secp256k1';

// import { ECPairFactory } from "./vendor/bitcoinjs-lib.js"
// console.log(bitcoinlib);
// const ECPair = ECPairFactory(ecc);

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
  setRefundPrivateKey,
  reverse,
  setReverse,
  config,
  setConfig,
  valid,
  setValid,
  amountValid,
  setAmountValid,
  swapValid,
  setSwapValid,
  invoice,
  setInvoice,
  onchainAddress,
  setOnchainAddress,
} from "./signals";


const Create = () => {

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
    if (denomination() == "sat") {
        amount = Math.ceil(amount);
    }
    setReceiveAmount(amount);
  });

  // validation swap
  createEffect(() => {
      if (!reverse() && invoice() || reverse() && onchainAddress()) {
        setSwapValid(true);
      } else {
        setSwapValid(false);
      }
  });

  // validation amount
  createEffect(() => {
      let send_amount = sendAmount();
      let target = document.getElementById("sendAmount");
      target.checkValidity();
      setAmountValid(true);
      for (let k in target.validity) {
        if (k === "valid") continue;
        if (target.validity[k]) {
          setReceiveAmount(k);
          setAmountValid(false);
          break;
        }
     };
  });

  // validation form
  createEffect(() => {
      let create_btn = document.getElementById("create-swap");
      if (amountValid() && swapValid()) {
        setValid(true);
        create_btn.disabled = false;
      } else {
        setValid(false);
        create_btn.disabled = true;
      }
  });

  const [t, { add, locale, dict }] = useI18n();

  const navigate = useNavigate();

    const create = () => {
        if (valid()) {
            let params = null;
            let cb = null;
            if (reverse()) {
                console.log("reverse not supported");
                // setPreimage(randomBytes(32));
                // setClaimECPair(ECPair.makeRandom());
                // params = {
                //     "type": "reversesubmarine",
                //     "pairId": "BTC/BTC",
                //     "orderSide": "buy",
                //     "invoiceAmount": sendAmount(),
                //     "preimageHash": crypto.sha256(preimage()).toString("hex"),
                //     "claimPublicKey": claimECPair().publicKey.toString("hex")
                // };
                // cb = (data) => {
                //     setStep(2);
                // };
            } else {
                const refundPrivateKey = secp.utils.randomPrivateKey();
                const refundPublicKey = secp.getPublicKey(refundPrivateKey);
                setRefundPrivateKey(secp.utils.bytesToHex(refundPrivateKey));
                params = {
                    "type": "submarine",
                    "pairId": "BTC/BTC",
                    "orderSide": "sell",
                    "refundPublicKey": secp.utils.bytesToHex(refundPublicKey),
                    "invoice": invoice()
                };
                cb = (data) => {
                    qr(data.bip21, setInvoiceQr);
                    navigate("/swap/"+data.id);
                };
            }
            fetcher("/createswap", cb, params);
        };
    };


  return (
    <div class="frame" data-reverse={reverse()} data-asset={asset()}>
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
      <Tags />
      <hr />
      <div class="icons">
        <div>
          <div className="asset asset-1" onClick={(e) => { setReverse(!reverse()); focus(); }}>
              <span class="icon-1 icon"></span>
              <span class="asset-text"></span>
          </div>
          <input autofocus required type="number" id="sendAmount" maxlength="10"
            step={denomination() == "btc" ? 0.00000001 : 1 }
            min={minimum()}
            max={maximum()}
            value={sendAmount()}
            onChange={(e) => setSendAmount(e.currentTarget.value)}
            onKeyUp={(e) => setSendAmount(e.currentTarget.value)}
          />
        </div>
        <div>
          <div onClick={(e) => { setReverse(!reverse()); focus(); }} class="asset asset-2">
              <span
                class="icon-2 icon"
              ></span>
              <span class="asset-text"></span>
          </div>
          <div class="receiveAmount">
            <span id="receiveAmount">{receiveAmount()}</span>
            <span class="denominator denominator-big" data-denominator={denomination()}></span>
          </div>
        </div>
      </div>
      <div class="fees-dyn">
        <label>{t("network_fee")}: <span class="network-fee">{minerFee()} <span class="denominator" data-denominator={denomination()}></span></span></label>
        <label>{t("fee")} ({boltzFee()}%): <span class="boltz-fee">{denomination() == "btc" ? ((sendAmount() * boltzFee()) / 100).toFixed(8) : Math.ceil((sendAmount() * boltzFee()) / 100)} <span class="denominator" data-denominator={denomination()}></span></span></label>
      </div>
      <hr />
      <label id="invoiceLabel">{t("create_and_paste", { amount: sendAmount(), denomination: denomination()})}</label>
      <textarea
        onChange={(e) => setInvoice(e.currentTarget.value)}
        onKeyUp={(e) => setInvoice(e.currentTarget.value)}
        id="invoice"
        name="invoice"
        placeholder="Paste lightning invoice"
      ></textarea>
      <input
        onChange={(e) => setOnchainAddress(e.currentTarget.value)}
        onKeyUp={(e) => setOnchainAddress(e.currentTarget.value)}
        type="text"
        id="onchainAddress"
        name="onchainAddress"
        placeholder="On-chain address"
      />
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
      <button id="create-swap" class="btn btn-success" onClick={create}>{t("create_swap")}</button>
    </div>
  );
};

export default Create;
