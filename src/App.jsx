/* @refresh reload */
import { createSignal, createEffect } from "solid-js";
import { render } from 'solid-js/web';
import { fetcher, qr } from './helper';

import {
  step, setStep,
  invoice, setInvoice,
  refundPublicKey, setRefundPublicKey,
  reverse, valid, setInvoiceQr, sendAmount,
  preimageHash, claimPublicKey
} from './signals';

import Step0 from './Step0';
import Step1 from './Step1';
import Success from './Success';
import Refund from './Refund';

const create = (e) => {
  if (valid()) {
    let params = null;
    let cb = null;
    if (reverse()) {
      params = {
        "type": "reversesubmarine",
        "pairId": "BTC/BTC",
        "orderSide": "buy",
        "invoiceAmount": sendAmount(),
        "preimageHash": preimageHash(),
        "claimPublicKey": claimPublicKey(),
      };
      cb = (data) => {
        setStep(2);
      };
    } else {
      params = {
        "type": "submarine",
        "pairId": "BTC/BTC",
        "orderSide": "sell",
        "refundPublicKey": refundPublicKey(),
        "invoice": invoice()
      };
      cb = (data) => {
        qr(data.bip21, setInvoiceQr);
        setStep(1);
      };
    }
    fetcher("/createswap", cb, params);
  };
};

const success = (e) => setStep(2);
const refund = (e) => setStep(3);

const App = () => {
  return (
    <div id="steps">
      <div class={step() == 0 ? "active" : ""}>
        <div class="container">
          <Step0 />
          <span class="btn" onClick={refund}>refund</span>
          <span class="btn btn-success" onClick={create}>create</span>
        </div>
      </div>
      <div class={step() == 1 ? "active" : ""}>
        <div class="container">
          <Step1 />
          <span class="btn btn-danger" onClick={(e) => setStep(0) }>cancel</span>
          <span class="btn btn-success" onClick={success}>success</span>
        </div>
      </div>
      <div class={step() == 2 ? "active" : ""}>
        <div class="container">
          <Success />
          <hr />
          <span class="btn btn-success" onClick={(e) => setStep(0) }>new swap</span>
          <a class="btn" target="_blank" href="https://mempool.space">mempool</a>
        </div>
      </div>
      <div class={step() == 3 ? "active" : ""}>
        <div class="container">
          <Refund />
          <span class="btn btn-danger" onClick={(e) => setStep(0) }>cancel</span>
        </div>
      </div>
    </div>
  );
}

export default App;
