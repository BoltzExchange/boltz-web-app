import { createSignal, createEffect } from "solid-js";
import { render } from "solid-js/web";
import fetcher from "./fetcher";

const App = () => {
  const [boltzFee, setBoltzFee] = createSignal(0);
  const [minerFee, setMinerFee] = createSignal(0);
  const [minimum, setMinimum] = createSignal(0);
  const [maximum, setMaximum] = createSignal(0);
  const [amount, setAmount] = createSignal(0);
  const [amount2, setAmount2] = createSignal(0);
  const [reverse, setReverse] = createSignal(0);
  const [config, setConfig] = createSignal(0);

  let factor = 0.00000001;

  fetcher("/getpairs", (data) => {
    let cfg = data.pairs["BTC/BTC"];
    setConfig(cfg);
    setMinimum(cfg.limits.minimal * factor);
    setMaximum(cfg.limits.maximal * factor);
    setMinerFee(cfg.fees.minerFees.baseAsset.normal * factor);
    setBoltzFee(cfg.fees.percentage);
    setAmount(cfg.limits.maximal * factor);
  });


  createEffect(() => {
    setAmount2(amount() - amount() * boltzFee() / 100);
  });

  // createEffect(() => {
  //   let cfg = config();
  //   if (reverse()) {
  //     let rev = cfg.fees.minerFees.baseAsset.reverse;
  //     let fee = rev.claim  + rev.lockUp;
  //     setMinerFee(fee * factor);
  //   } else {
  //     setMinerFee(cfg.fees.minerFees.baseAsset.normal * factor);
  //   }

  // });

  return (
    <div class="container">
      <form action="#">
        <div>
          <input type="text" id="amount" value={amount()} onChange={(e) => setAmount(e.currentTarget.value)} />
        </div>
        <div>
          <input type="checkbox" id="reverse" value={reverse()} onChange={(e) => setReverse(e.currentTarget.value)} />
        </div>
        <div>
          <input type="text" id="amount2" value={amount2()} onChange={(e) => setAmount2(e.currentTarget.value)} />
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
    </div>
  );
};

export default App;
