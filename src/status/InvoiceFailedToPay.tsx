import type { Accessor } from "solid-js";

import RefundButton from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const InvoiceFailedToPay = () => {
    const { failureReason, swap } = usePayContext();
    const { t } = useGlobalContext();

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <RefundButton swap={swap as Accessor<SubmarineSwap | ChainSwap>} />
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
