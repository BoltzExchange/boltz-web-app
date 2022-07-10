import { createEffect } from "solid-js";
import { render } from "solid-js/web";
import { fetcher, divider, startInterval, focus } from "./helper";
import Tags from "./Tags";

import {
  boltzFee, setBoltzFee,
  sendAmount, setSendAmount,
  minerFee, setMinerFee,
  minimum, setMinimum,
  maximum, setMaximum,
  receiveAmount, setReceiveAmount,
  reverse, setReverse,
  config, setConfig,
} from "./signals";

const Step0 = () => {

  setSendAmount(0.05);

  startInterval(() => {
    fetcher("/getpairs", (data) => {
      let cfg = data.pairs["BTC/BTC"];
      setConfig(cfg);
    });
  });

  createEffect(() => {
    let cfg = config()
    if (cfg) {
      setMinimum(cfg.limits.minimal / divider);
      setMaximum(cfg.limits.maximal / divider);
      setBoltzFee(cfg.fees.percentage);
      setReceiveAmount(sendAmount() - sendAmount() / 100 * boltzFee());
      if (reverse()) {
        let rev = cfg.fees.minerFees.baseAsset.reverse;
        let fee = (rev.claim  + rev.lockup) / divider;
        setMinerFee(fee.toFixed(8));
      } else {
        setMinerFee(cfg.fees.minerFees.baseAsset.normal / divider);
      }
    }
  });

  return (
    <div data-reverse={reverse()}>
      <h2>Create Submarine Swap</h2>
    <p>Payment includes miner and boltz service fees.</p>
      <hr />
      <div class="icons">
        <div><span class="icon-1 icon" onClick={(e) => setReverse(!reverse()) }></span></div>
        <div>
            <div id="reverse">
              <input type="checkbox" value="true" checked={reverse()} onChange={(e) => {
                setReverse(e.currentTarget.checked);
                focus();
              }} />
            </div>
        </div>
        <div><span class="icon-2 icon" onClick={(e) => setReverse(!reverse()) }></span></div>
      </div>
      <form name="swap" action="#">
        <div>
          <div>
            <input autofocus maxlength="10" min={minimum()} max={maximum()} type="text" id="sendAmount" value={sendAmount()} onKeyUp={(e) => {
              setSendAmount(e.currentTarget.value);
              let valid = e.currentTarget.checkValidity();
              console.log(valid);
            }} />
            <label>BTC</label>
          </div>
          <div>
            <span id="receiveAmount" onClick={(e) => {
              setReverse(!reverse());
              focus();
            }} >{receiveAmount()}</span>
            <label>BTC</label>
          </div>
        </div>
      </form>
      <Tags />
      <hr />
      <div class="fees">
        <div class="fee">
          <span><b>{minimum()} BTC</b></span><br />
          <label>Min. amount</label>
        </div>
        <div class="fee">
          <span><b>{maximum()} BTC</b></span><br />
          <label>Max. amount</label>
        </div>
        <div class="fee">
          <span><b>{boltzFee()} %</b></span><br />
          <label>Boltz fee</label>
        </div>
        <div class="fee">
          <span><b>{minerFee()} BTC</b></span><br />
          <label>Miner fee</label>
        </div>
      </div>
      <hr />
      <p>Click the button to create a swap and a popover with invoice details will appear.</p>
    </div>
  );
};

export default Step0;
