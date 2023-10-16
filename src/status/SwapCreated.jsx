import log from "loglevel";
import { Show } from "solid-js";
import t from "../i18n";
import { clipboard } from "../helper";
import { enableWebln } from "../utils/webln";
import { formatAmount } from "../utils/denomination";
import { invoiceQr, swap, webln, denomination } from "../signals";

const SwapCreated = () => {
    const payWeblnInvoice = async (pr) => {
        enableWebln(async () => {
            const result = await window.webln.sendPayment(pr);
            log.debug("webln payment result:", result);
        });
    };

    const cropInvoice = (invoice) => {
        return (
            invoice.substring(0, 20) +
            "..." +
            invoice.substring(invoice.length - 20)
        );
    };

    return (
        <div>
            <h4>{t("warning_return")}</h4>
            <hr />
            <p>
                {t("pay_timeout_blockheight")}: {swap().timeoutBlockHeight}
            </p>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <h2>
                {t("send_to", {
                    amount: formatAmount(swap().sendAmount),
                    denomination: denomination(),
                })}
            </h2>
            <p
                onclick={() => clipboard(swap().invoice, t("copied"))}
                class="address-box break-word">
                {cropInvoice(swap().invoice)}
            </p>
            <hr />
            <Show when={webln()}>
                <span
                    class="btn btn-light"
                    onClick={() => payWeblnInvoice(swap().invoice)}>
                    {t("pay_invoice_webln")}
                </span>
            </Show>
            <span
                class="btn"
                onclick={() => clipboard(swap().invoice, t("copied"))}>
                {t("copy_invoice")}
            </span>
        </div>
    );
};

export default SwapCreated;
