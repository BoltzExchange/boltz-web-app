/* @refresh reload */
import { render } from "solid-js/web";
import { sendAmount, setSendAmount, minimum, maximum } from "./signals";
import { focus } from "./helper";
import { checkAmount } from "./Step0";

const Tags = () => {
  return (
    <div class="tags">
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            setSendAmount(minimum());
            checkAmount();
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
            setSendAmount((parseFloat(sendAmount()) - 0.001).toPrecision(8));
            checkAmount();
            focus();
          }}
        >
          - 100K
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            setSendAmount(0.01);
            checkAmount();
            focus();
          }}
        >
          1M
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            setSendAmount((parseFloat(sendAmount()) + 0.001).toPrecision(8));
            checkAmount();
            focus();
          }}
        >
          + 100K
        </span>
      </div>
      <div class="tag">
        <span
          class="btn"
          onClick={(e) => {
            setSendAmount(maximum());
            checkAmount();
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
