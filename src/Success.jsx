import { render } from "solid-js/web";
import { sendAmount } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const Success = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [t, { add, locale, dict }] = useI18n();
  return (
    <div class="frame">
      <h2>Congratulations! Swap: {params.id} complete!</h2>
      <p>You have successfully swapped {sendAmount()} BTC.</p>
      <hr />
      <span class="btn btn-success" onClick={(e) => navigate("/swap")}>{t("new_swap")}</span>
      <a class="btn btn-mempool" target="_blank" href="https://mempool.space">{t("mempool")}</a>
    </div>
  );
};

export default Success;
