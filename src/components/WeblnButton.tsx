import { requestProvider } from "@getalby/bitcoin-connect";
import log from "loglevel";

import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";

const WeblnButton = () => {
    const { t } = useGlobalContext();
    const { receiveAmount, amountValid, setInvoice } = useCreateContext();

    const createWeblnInvoice = async () => {
        const weblnProvider = await requestProvider();
        const amount = Number(receiveAmount());
        const invoice = await weblnProvider.makeInvoice({ amount: amount });
        log.debug("created webln invoice", invoice);
        setInvoice(invoice.paymentRequest);
    };
    return (
        <button
            id="webln"
            disabled={!amountValid() && !receiveAmount().isZero()}
            class="btn btn-light"
            onClick={() => createWeblnInvoice()}>
            {t("create_invoice_webln")}
        </button>
    );
};

export default WeblnButton;
