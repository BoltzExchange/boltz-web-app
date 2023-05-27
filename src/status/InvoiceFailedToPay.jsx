import log from "loglevel";
import { createSignal } from "solid-js";
import { useI18n } from "@solid-primitives/i18n";
import fetcher, { refundAddressChange } from "../helper";
import {
    failureReason,
    swap,
    timeoutEta,
    setTransactionToRefund,
} from "../signals";
import RefundEta from "../components/RefundEta";
import DownloadRefund from "../components/DownloadRefund";

const InvoiceFailedToPay = () => {
    const [t] = useI18n();
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
            }
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
