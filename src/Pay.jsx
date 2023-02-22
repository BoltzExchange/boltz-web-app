import { render } from "solid-js/web";
import { invoiceQr, setInvoiceQr } from "./signals";
import { useParams, useNavigate } from "@solidjs/router";
import { useI18n } from "@solid-primitives/i18n";

const Pay = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [t, { add, locale, dict }] = useI18n();
  return (
    <div class="frame">
      <h2>{t("pay_invoice", {id: params.id})}</h2>
      <p>{t("pay_invoice_subline")}</p>
      <hr />
      <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
      <span class="btn btn-success" onclick={() => navigate("/swap/1zt192/success")}>Success test</span>
    </div>
  );
};

export default Pay;
