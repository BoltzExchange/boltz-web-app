import { render } from "solid-js/web";
import { sendAmount, denomination } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const Success = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [t, { add, locale, dict }] = useI18n();
  return (
    <div class="frame">
      <h2>{t("congrats", {id: params.id})}</h2>
      <p>{t("successfully_swapped", {amount: sendAmount(), denomination: denomination()})}</p>
      <hr />
      <span class="btn" onClick={(e) => navigate("/swap")}>{t("new_swap")}</span>
      <a class="btn btn-mempool" target="_blank" href="https://mempool.space">{t("mempool")}</a>
    </div>
  );
};

export default Success;
