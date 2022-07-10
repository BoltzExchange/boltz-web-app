/* @refresh reload */
import { createSignal, createEffect } from "solid-js";
import { render } from 'solid-js/web';
import Step0 from './Step0';
import Step1 from './Step1';
import { fetcher } from './helper';
import { step, setStep, valid } from './signals';

const create_swap = (e) => {
  if (valid()) {
    setStep(1);
  };
  // const params = {
  //   yo: "yo"
  // };
  // fetcher("/getpairs", (data) => {
  //   let cfg = data.pairs["BTC/BTC"];
  //   setConfig(cfg);
  // }, {
  //     method: 'POST',
  //     body: JSON.stringify( params )
  // });
};

const App = () => {
  return (
    <div id="steps">
      <div class={step() == 0 ? "active" : ""}>
        <div class="container">
          <Step0 />
          <span class="btn btn-success" onClick={create_swap}>create</span>
        </div>
      </div>
      <div class={step() == 1 ? "active" : ""}>
        <div class="container">
          <Step1 />
          <span class="btn btn-danger" onClick={(e) => setStep(0) }>cancel</span>
        </div>
      </div>
    </div>
  );
}

export default App;
