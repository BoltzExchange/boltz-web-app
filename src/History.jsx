import { swaps, setSwaps } from "./signals";
import { downloadBackup } from "./helper";

import { useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

import "./css/history.css";

const History = () => {

  const navigate = useNavigate();
  const [t] = useI18n();

  const printDate = (d) => {
    let date = new Date();
    date.setTime(d);
    return date.toLocaleDateString();
  };

  const deleteLocalstorage = () => {
      if(confirm(t("delete_localstorage"))) {
          setSwaps("[]")
      }
  };


  const delete_swap = (swap_id) => {
      if(confirm(t("delete_localstorage"))) {
          let tmp_swaps = JSON.parse(swaps());
          if (tmp_swaps) {
              let new_swaps = tmp_swaps.filter(s => s.id !== swap_id);
              setSwaps(JSON.stringify(new_swaps));
          }
      }
  };


  return (
    <div id="history">
        <Show when={JSON.parse(swaps()).length > 0}>
            <div class="frame">
              <h2>{t("refund_past_swaps")}</h2>
              <p>{t("refund_past_swaps_subline")}</p>
              <hr />
              <div id="past-swaps">
                  <For each={JSON.parse(swaps())}>
                      {(_swap) => (
                          <div class="past-swap">
                              <span class="btn-small" onClick={() => navigate("/swap/" + _swap.id)}>view</span>
                              <span data-reverse={_swap.reverse} data-asset={_swap.asset} class="past-asset">-&gt;</span>
                              &nbsp;ID: {_swap.id}, created: {printDate(_swap.date)}&nbsp;
                              <span class="btn-small btn-danger" onClick={() => delete_swap(_swap.id)}>delete</span>
                              <hr />
                          </div>
                      )}
                  </For>
              </div>
            <div class="btns">
              <button class="btn btn-danger" onClick={deleteLocalstorage}>{t("refund_clear")}</button>
              <button class="btn " onClick={() => downloadBackup(swaps())}>{t("refund_backup")}</button>
            </div>
            </div>
        </Show>
    </div>
  );
};

export default History;
