import { render } from "solid-js/web";
import { invoiceQr, setInvoiceQr } from "./signals";

const Step1 = () => {
  return (
    <div>
      <h2>Pay invoice</h2>
      <p>Pay your invoice and the swap is done.</p>
      <hr />
      <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
    </div>
  );
};

export default Step1;
