import log from "loglevel";
import { useI18n } from "@solid-primitives/i18n";
import { enableWebln } from "../utils/webln";
import { invoiceQr, swap, webln } from "../signals";
import { fetchSwapStatus, clipboard } from "../helper";

const SwapCreated = () => {
    const [t] = useI18n();

    const payWeblnInvoice = async (pr) => {
        enableWebln(async () => {
            const result = await window.webln.sendPayment(pr);
            log.debug("webln payment result:", result);
            fetchSwapStatus(swap());
        });
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
