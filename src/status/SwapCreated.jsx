import log from "loglevel";
import { Show } from "solid-js";

import { clipboard, cropString } from "../helper";
import t from "../i18n";
import { denomination, invoiceQr, swap, webln } from "../signals";
import { formatAmount } from "../utils/denomination";
import { enableWebln } from "../utils/webln";

const SwapCreated = () => {
    const payWeblnInvoice = async (pr) => {
        enableWebln(async () => {
            const result = await window.webln.sendPayment(pr);
            log.debug("webln payment result:", result);
        });
    };

    return (
        <div>
            <h2>
                {t("pay_invoice_to", {
                    amount: formatAmount(swap().sendAmount),
                    denomination: denomination(),
                })}
            </h2>
            <hr />
            <img id="invoice-qr" src={invoiceQr()} alt="pay invoice qr" />
            <hr />
            <p
                onclick={() => clipboard(swap().invoice, t("copied"))}
                class="address-box break-word">
                {cropString(swap().invoice)}
            </p>
            <hr />
            <h3>{t("warning_return")}</h3>
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
