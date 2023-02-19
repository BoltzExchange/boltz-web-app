import { render } from "solid-js/web";
import { sendAmount } from "./signals";

const Success = () => {
  return (
    <div>
      <h2>Congratulations!</h2>
      <p>You have successfully swapped {sendAmount()} BTC.</p>
      <hr />
      <div class="animation-spacer">
        <div class="bitcoin-icon rotate infinite linear"></div>
      </div>
    </div>
  );
};

export default Success;
