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
      setReceiveAmount(sendAmount() - sendAmount() * boltzFee() / 100);
      if (reverse()) {
        let rev = cfg.fees.minerFees.baseAsset.reverse;
        let fee = rev.claim  + rev.lockup;
        setMinerFee(fee / divider);
      } else {
        setMinerFee(cfg.fees.minerFees.baseAsset.normal / divider);
      }
    }
  });

  return (
    <div class="container">
      <form action="#" data-reverse={reverse()}>
        <div>
          <input type="text" id="sendAmount" value={sendAmount()} onKeyUp={(e) => setSendAmount(e.currentTarget.value)} />
        </div>
        <div>
          <input type="checkbox" id="reverse" value={reverse()} onChange={(e) => setReverse(e.currentTarget.checked)} />
        </div>
        <div>
          <span id="receiveAmount">{receiveAmount()} BTC</span>
        </div>
      </form>
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
      <div class="tags">
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.0001)}>100K</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.0005)}>500K</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.001)}>1M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.003)}>3M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.05)}>5M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.007)}>7M</span>
        </div>
        <div class="tag">
          <span class="btn" onClick={(e) => setSendAmount(0.1)}>10M</span>
        </div>
      </div>
    </div>
  );
};

export default App;
