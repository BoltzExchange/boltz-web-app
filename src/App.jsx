import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";
import fetcher from "./fetcher";

const startInterval = (cb) => {
  cb();
  return setInterval(cb, 10000);
};

const App = () => {
  const [boltzFee, setBoltzFee] = createSignal(0);
  const [minerFee, setMinerFee] = createSignal(0);
  const [minimum, setMinimum] = createSignal(0);
  const [maximum, setMaximum] = createSignal(0);
  const [sendAmount, setSendAmount] = createSignal(0);
  const [receiveAmount, setReceiveAmount] = createSignal(0);
  const [reverse, setReverse] = createSignal(false);
  const [config, setConfig] = createSignal(0);

  let divider = 100000000;

  const focus = () => {
     document.getElementById('sendAmount').focus();
  };

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
    <div class="container" data-reverse={reverse()}>
      <h2>Create Submarine Swap</h2>
    <p>Payment includes, miner and boltz service fees.</p>
      <hr />
      <div class="icons">
        <div><img src="/src/assets/bitcoin-icon.svg" alt="" /></div>
        <div>
            <div id="reverse">
              <input type="checkbox" value={reverse()} onChange={(e) => {
                setReverse(e.currentTarget.checked);
                focus();
              }} />
            </div>
        </div>
        <div><img src="/src/assets/lightning-icon.svg" alt="" /></div>
      </div>
      <form action="#">
        <div>
          <input autofocus type="text" id="sendAmount" value={sendAmount()} onKeyUp={(e) => setSendAmount(e.currentTarget.value)} />
          <label>BTC</label>
        </div>
        <div>
          <span id="receiveAmount">{receiveAmount()}</span>
          <label>BTC</label>
        </div>
      </form>
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
      <div class="tags">
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.001);
            focus();
          }}>100K</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.005);
            focus();
          }}>500K</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.01);
            focus();
          }}>1M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.03);
            focus();
          }}>3M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.05);
            focus();
          }}>5M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.07);
            focus();
          }}>7M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => {
            setSendAmount(0.1);
            focus();
          }}>10M</span>
        </div>
      </div>
      <p>Click the button to create a swap and a popover with invoice details will appear.</p>
      <span class="btn" onClick={(e) => createSwap()}>Create Swap</span>
    </div>
  );
};

export default App;
