/* @refresh reload */
import { render } from "solid-js/web";
import { sendAmount, setSendAmount, minimum, maximum, denomination } from "./signals";
import { focus } from "./helper";

const Tags = () => {
  return (
    <div class="tags">
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            setSendAmount(minimum());
            focus();
          }}
        >
          min
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            let amount = (denomination() == "btc") ? 0.001 : 100000;
            amount = (denomination() == "btc") ? (parseFloat(sendAmount()) - amount).toPrecision(8) : sendAmount() - amount;
            setSendAmount(amount);
            focus();
          }}
        >
          - {(denomination() == "btc") ? "0.001" : "100K"}
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            let amount = (denomination() == "btc") ? 0.01 : 1000000;
            setSendAmount(amount);
            focus();
          }}
        >
          {(denomination() == "btc") ? "0.01" : "1M"}
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            let amount = (denomination() == "btc") ? 0.001 : 100000;
            amount = (denomination() == "btc") ? (parseFloat(sendAmount()) + amount).toPrecision(8) : parseInt(sendAmount()) + amount;
            setSendAmount(amount);
            focus();
          }}
        >
          + {(denomination() == "btc") ? "0.001" : "100K"}
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            setSendAmount(maximum());
            focus();
          }}
        >
          max
        </span>
      </div>
    </div>
  );
};

export default Tags;
