/* @refresh reload */
import { render } from 'solid-js/web';
import { setSendAmount } from './signals';
import { focus } from './helper';

const Tags = () => {
  return (
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
  );
}

export default Tags;
