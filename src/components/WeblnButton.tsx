import log from "loglevel";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { enableWebln } from "../utils/webln";

const WeblnButton = () => {
    const { t } = useGlobalContext();
    const { receiveAmount, amountValid, setInvoice } = useCreateContext();

    const createWeblnInvoice = async () => {
        await enableWebln(async () => {
            const amount = Number(receiveAmount());
            const invoice = await window.webln.makeInvoice({ amount: amount });
            log.debug("created webln invoice", invoice);
            setInvoice(invoice.paymentRequest);
        });
    };
    return (
        <button
            id="webln"
            disabled={!amountValid()}
            class="btn btn-light"
            onClick={() => createWeblnInvoice()}>
            {t("create_invoice_webln")}
        </button>
    );
};

export default WeblnButton;
