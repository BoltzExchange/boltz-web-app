/* @refresh reload */
import { render } from 'solid-js/web';
import { setSendAmount, minimum, maximum } from './signals';
import { focus } from './helper';
import { checkAmount } from './Step0';

const Tags = () => {
  return (
    <div class="tags">
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(minimum());
          checkAmount();
          focus();
        }}>min</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(0.001);
          checkAmount();
          focus();
        }}>100K</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(0.005);
          checkAmount();
          focus();
        }}>500K</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(0.01);
          checkAmount();
          focus();
        }}>1M</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(0.03);
          checkAmount();
          focus();
        }}>3M</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(0.05);
          checkAmount();
          focus();
        }}>5M</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(0.07);
          checkAmount();
          focus();
        }}>7M</span>
      </div>
      <div class="tag">
        <span class="btn" onClick={(e) => {
          setSendAmount(maximum());
          checkAmount();
          focus();
        }}>max</span>
      </div>
    </div>
  );
}

export default Tags;
