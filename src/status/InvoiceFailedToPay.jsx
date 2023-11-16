import DownloadRefund from "../components/DownloadRefund";
import RefundEta from "../components/RefundEta";
import fetcher, { refund, refundAddressChange } from "../helper";
import t from "../i18n";
import {
    failureReason,
    setTransactionToRefund,
    swap,
    timeoutEta,
} from "../signals";
import log from "loglevel";
import { createEffect, createSignal } from "solid-js";

const InvoiceFailedToPay = () => {
    const [valid, setValid] = createSignal(false);

    createEffect(() => {
        setTransactionToRefund(null);
        fetcher(
            "/getswaptransaction",
            (res) => {
                log.debug(`got swap transaction for ${swap().id}`);
                setTransactionToRefund(res);
            },
            {
                id: swap().id,
            },
            () => {
                log.warn(`no swap transaction for: ${swap().id}`);
            },
        );
    });

    return (
        <div>
            <h2>{t("invoice_payment_failure")}</h2>
            <p>
                {t("failure_reason")}: {failureReason()}
            </p>
            <hr />
            <Show when={timeoutEta()}>
                <RefundEta />
            </Show>
            <Show when={!timeoutEta()}>
                <h2>{t("refund")}</h2>
                <input
                    onInput={(e) =>
                        setValid(refundAddressChange(e, swap().asset))
                    }
                    type="text"
                    id="refundAddress"
                    name="refundAddress"
                    placeholder={t("refund_address_placeholder")}
                />
                <button
                    class="btn"
                    disabled={valid() ? "" : "disabled"}
                    onclick={() => refund(swap())}>
                    {t("refund")}
                </button>
            </Show>
            <DownloadRefund />
            <hr />
        </div>
    );
};

export default InvoiceFailedToPay;
