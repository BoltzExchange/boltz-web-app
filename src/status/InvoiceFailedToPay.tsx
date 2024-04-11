import { OutputType } from "boltz-core";
import { Accessor, Show } from "solid-js";

import DownloadRefund from "../components/DownloadRefund";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { RBTC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

const InvoiceFailedToPay = () => {
    const { failureReason, swap, timeoutEta } = usePayContext();
    const { t } = useGlobalContext();
    const isTaproot = swap().version === OutputType.Taproot;

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show
                when={!timeoutEta() || isTaproot || swap().assetSend === RBTC}
                fallback={<RefundEta />}>
                <RefundButton
                    swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                />
            </Show>
            <Show when={swap().assetSend !== RBTC && !isTaproot}>
                <DownloadRefund />
            </Show>
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
