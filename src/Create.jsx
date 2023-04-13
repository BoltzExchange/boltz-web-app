import log from 'loglevel';
import { createEffect, onCleanup } from "solid-js";
import { useI18n } from "@solid-primitives/i18n";
import { fetcher, lnurl_fetcher, btc_divider } from "./helper";
import { useNavigate } from "@solidjs/router";

import * as secp from '@noble/secp256k1';
import { ECPair } from './ecpair/ecpair';
import { address } from 'bitcoinjs-lib';

import AssetSelect from "./AssetSelect";

import btc_svg from "./assets/btc.svg";
import sat_svg from "./assets/sat.svg";
import reload_svg from "./assets/reload.svg";
import arrow_svg from "./assets/arrow.svg";

import { bolt11_prefix, net } from "./config";

import {
  swaps,
  setSwaps,
  assetSelect,
  setAssetSelect,
  asset,
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
  setSwapValid,
  invoice,
  setInvoice,
  onchainAddress,
  setOnchainAddress,
  setNotification,
  setNotificationType,
  webln,
} from "./signals";

const Create = () => {

  // set fees and pairs
  createEffect(() => {
    let cfg = config();
    let denom = denomination();
    if (cfg) {
      let divider = (denom == "btc") ? btc_divider : 1;
      setMinimum(cfg.limits.minimal / divider);
      setMaximum(cfg.limits.maximal / divider);
      setBoltzFee(cfg.fees.percentage);
      // TODO issue do not touch amounts when flipping assets
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

  // reset send amount when changing denomination
  createEffect(() => {
    let send_amount = 100000;
    if (denomination() == "btc") {
        send_amount = 0.001;
    }
    setSendAmount(send_amount)
    setReceiveAmount(calculateReceiveAmount(send_amount))
  });

  // validation swap
  createEffect(() => {
      if (!reverse() && invoice() || reverse() && onchainAddress()) {
        setSwapValid(true);
      } else {
        setSwapValid(false);
      }
  });

  const [t] = useI18n();

  const navigate = useNavigate();

  const fetchPairs = () => {
    fetcher("/getpairs", (data) => {
        log.debug("getpairs", data);
        let cfg = data.pairs["BTC/BTC"];
        setConfig(cfg);
        setNotificationType("success");
        setNotification("successfully updated fees!");
    });
    return false;
  };

  const formatAmount = (amount) => {
    if (denomination() == "btc") {
        amount = amount.toFixed(8);
    }
    if (denomination() == "sat") {
        amount = Math.ceil(amount);
    }
    return amount;
  };

  const calculateReceiveAmount = (amount) => {
    amount = parseFloat(amount) - minerFee() - (amount * boltzFee()) / 100;
    return formatAmount(amount);
  };

  const calculateSendAmount = (amount) => {
    amount = parseFloat(amount) + parseFloat(minerFee()) + (amount * boltzFee()) / 100;
    return formatAmount(amount);
  };

  const changeReceiveAmount = (amount) => {
    setReceiveAmount(amount);
    setSendAmount(calculateSendAmount(amount));
  };

  const changeSendAmount = (amount) => {
    setSendAmount(amount);
    setReceiveAmount(calculateReceiveAmount(amount));
  };

  const createWeblnInvoice = async () => {
      let check_enable = await window.webln.enable();
      if (check_enable.enabled) {
          let amount = receiveAmount();
          if (denomination() == "btc") {
              amount = amount * 100000000;
          }
          const invoice = await window.webln.makeInvoice({ amount: amount });
          log.debug ("created webln invoice", invoice);
          setInvoice(invoice.paymentRequest);
      }
  };

  const create = async () => {
      setValid(true);
      if (valid()) {

          const pair = ECPair.makeRandom();
          const privateKeyHex = pair.privateKey.toString("hex");
          const publicKeyHex = pair.publicKey.toString("hex");
          let params = null;
          let preimageHex = null;

          if (reverse()) {
              try {
                // validate btc address
                address.toOutputScript(onchainAddress(), net);
              }
              catch (e) {
                  log.error(e);
                  setNotificationType("error");
                  setNotification("invalid onchain address");
                  return false;
              }
              const preimage = secp.utils.randomBytes(32);
              preimageHex = secp.utils.bytesToHex(preimage);
              let preimageHash = await secp.utils.sha256(preimage);
              let preimageHashHex = secp.utils.bytesToHex(preimageHash);
              // TODO: not hardcode asset
              params = {
                  "type": "reversesubmarine",
                  "pairId": "BTC/BTC",
                  "orderSide": "buy",
                  "invoiceAmount": parseInt(sendAmount()),
                  "claimPublicKey": publicKeyHex,
                  "preimageHash": preimageHashHex
              };
          } else {
              if (invoice().indexOf("@") > 0 || invoice().indexOf("lnurl") == 0 || invoice().indexOf("LNURL") == 0) {
                  let amount = receiveAmount();
                  if (denomination() == "btc") {
                      amount = amount * 100000000;
                  }
                  let pr = await lnurl_fetcher(invoice(), amount);
                  setInvoice(pr);
              }
              if (invoice().indexOf(bolt11_prefix) != 0) {
                  log.warn("neither lnurl, lnaddress or invoice supplied")
                  return false;
              }
              params = {
                  "type": "submarine",
                  "pairId": "BTC/BTC",
                  "orderSide": "sell",
                  "refundPublicKey": publicKeyHex,
                  "invoice": invoice()
              };
          }
          fetcher("/createswap", (data) => {
              data.privateKey = privateKeyHex;
              data.date = (new Date()).getTime();
              data.reverse = reverse();
              data.asset = asset();
              data.preimage = preimageHex;
              data.onchainAddress = onchainAddress();
              let tmp_swaps = JSON.parse(swaps());
              tmp_swaps.push(data)
              setSwaps(JSON.stringify(tmp_swaps));
              setInvoice("");
              setOnchainAddress("");
              navigate("/swap/" + data.id);
          }, params);
      };
  };


  let timer = setInterval(() => {
      log.debug("tick Create")
      fetchPairs();
  }, 30000);

  onCleanup(() => {
      log.debug("cleanup Create")
      clearInterval(timer)
  });

  fetchPairs();

  return (
    <div class="frame" data-reverse={reverse()} data-asset={asset()}>
      <h2>{t("create_swap")}</h2>
      <p>{t("create_swap_subline")}</p>
      <hr />
      <div class="icons">
        <div>
          <div className="asset-wrap" onClick={() => setAssetSelect(!assetSelect())}>
              <div className="asset asset-1">
                  <div className="asset-selected">
                      <span class="icon-1 icon"></span>
                      <span class="asset-text"></span>
                      <span class="arrow-down"></span>
                  </div>
              </div>
          </div>
          <input autofocus required type="number" id="sendAmount" maxlength="10"
            step={denomination() == "btc" ? 0.00000001 : 1 }
            min={minimum()}
            max={maximum()}
            value={sendAmount()}
            onChange={(e) => changeSendAmount(e.currentTarget.value)}
            onKeyUp={(e) => changeSendAmount(e.currentTarget.value)}
          />
        </div>
        <div id="flip-assets" onClick={() => { setReverse(!reverse()) }}>
            <img src={arrow_svg} alt="flip assets" />
        </div>
        <div>
          <div className="asset-wrap" onClick={() => setAssetSelect(!assetSelect())}>
              <div className="asset asset-2">
                  <div className="asset-selected">
                      <span class="icon-2 icon"></span>
                      <span class="asset-text"></span>
                      <span class="arrow-down"></span>
                  </div>
              </div>
              <div class="assets-select">
              </div>
          </div>
          <input autofocus required type="number" id="receiveAmount" maxlength="10"
            step={denomination() == "btc" ? 0.00000001 : 1 }
            min={minimum()}
            max={maximum()}
            value={receiveAmount()}
            onChange={(e) => changeReceiveAmount(e.currentTarget.value)}
            onKeyUp={(e) => changeReceiveAmount(e.currentTarget.value)}
          />
        </div>
      </div>
      <div class="fees-dyn">
        <div class="denomination">
            <label>{t("denomination")}: </label>
            <img src={btc_svg} onClick={() => setDenomination("btc")} class={denomination() == "btc" ? "active" : ""} alt="denominator" />
            <img src={sat_svg} onClick={() => setDenomination("sat")} class={denomination() == "sat" ? "active" : ""} alt="denominator" />
        </div>
        <label>
            <span class="icon-reload" onClick={fetchPairs}><img src={reload_svg} /></span>
            {t("network_fee")}: <span class="network-fee">{minerFee()} <span class="denominator" data-denominator={denomination()}></span></span><br />
            {t("fee")} ({boltzFee()}%): <span class="boltz-fee">{denomination() == "btc" ? ((sendAmount() * boltzFee()) / 100).toFixed(8) : Math.ceil((sendAmount() * boltzFee()) / 100)} <span class="denominator" data-denominator={denomination()}></span></span>
        </label>
      </div>
      <hr />
      <Show when={webln() && !reverse()}>
          <button class="btn btn-light" onClick={() => createWeblnInvoice()}>{t("create_invoice_webln")}</button>
          <hr />
      </Show>
      <textarea
        onChange={(e) => setInvoice(e.currentTarget.value)}
        onKeyUp={(e) => setInvoice(e.currentTarget.value)}
        id="invoice"
        name="invoice"
        value={invoice()}
        placeholder={t("create_and_paste", { amount: receiveAmount(), denomination: denomination()})}
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
      <button id="create-swap" class="btn" onClick={create}>{t("create_swap")}</button>
      <AssetSelect />
    </div>
  );
};

export default Create;
